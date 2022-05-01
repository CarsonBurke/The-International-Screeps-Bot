import { constants } from "international/constants"
import { customLog, findAvgBetweenPosotions, findPositionsInsideRect, getRange, getRangeBetween, pack } from "international/generalFunctions"
import 'other/RoomVisual'

/**
 * Checks if a room can be planner. If it can, it informs information on how to build the room
 */
export function basePlanner(room: Room) {

    // Get a cost matrix of walls and exit areas

    const baseCM: CostMatrix = room.get('baseCM'),
    roadCM: CostMatrix = room.get('roadCM'),
    structurePlans: CostMatrix = room.get('structurePlans')

    if (!room.global.stampAnchors) {

        room.global.stampAnchors = {}
        for (const type in constants.stamps) room.global.stampAnchors[type as StampTypes] = []
    }

    function recordAdjacentPositions(x: number, y: number, range: number, weight?: number) {

        // Construct a rect and get the positions in a range of 1

        const adjacentPositions = findPositionsInsideRect(x - range, y - range, x + range, y + range)

        // Loop through adjacent positions

        for (const adjacentPos of adjacentPositions) {

            // Iterate if the adjacent pos is to avoid

            if (baseCM.get(adjacentPos.x, adjacentPos.y) > 0) continue

            // Otherwise record the position in the base cost matrix as avoid

            baseCM.set(adjacentPos.x, adjacentPos.y, weight || 255)
        }
    }

    // Get the controller and set positions nearby to avoid

    recordAdjacentPositions(room.controller.pos.x, room.controller.pos.y, 2)

    // Get and record the mineralHarvestPos as avoid

    const mineralHarvestPos: RoomPosition = room.get('closestMineralHarvestPos')
    baseCM.set(mineralHarvestPos.x, mineralHarvestPos.y, 255)

    // Record the positions around sources as unusable

    const sources: Source[] = room.get('sources')

    // Loop through each source, marking nearby positions as avoid

    for (const source of sources) recordAdjacentPositions(source.pos.x, source.pos.y, 2)

    // Find the average pos between the sources

    const avgSourcePos = findAvgBetweenPosotions(sources[0].pos, sources[1].pos),

    // Find the average pos between the two sources and the controller

    avgControllerSourcePos = findAvgBetweenPosotions(room.controller.pos, avgSourcePos)

    interface PlanStampOpts {
        stampType: StampTypes
        count: number
        anchorOrient: Pos
        initialWeight?: number
        adjacentToRoads?: boolean
        normalDT?: boolean
    }

    /**
     * Tries to plan a stamp's placement in a room around an orient. Will inform the achor of the stamp if successful
     */
    function planStamp(opts: PlanStampOpts): boolean {

        // Define the stamp using the stampType

        const stamp = constants.stamps[opts.stampType]

        opts.count -= room.global.stampAnchors[opts.stampType].length

        // So long as the count is more than 0

        while (opts.count > 0) {

            // Decrease the count

            opts.count--

            // Run distance transform with the baseCM

            const distanceCM = opts.normalDT ? room.distanceTransform(baseCM) : room.specialDT(baseCM),

            // Try to find an anchor using the distance cost matrix, average pos between controller and sources, with an area able to fit the fastFiller

            anchor = room.findClosestPosOfValue({
                CM: distanceCM,
                startPos: opts.anchorOrient,
                requiredValue: stamp.size,
                initialWeight: opts.initialWeight || 0,
                adjacentToRoads: opts.adjacentToRoads,
                roadCM: opts.adjacentToRoads ? roadCM : undefined
            })

            // Inform false if no anchor was generated

            if (!anchor) return false

            // Add the anchor to stampAnchors based on its type

            room.global.stampAnchors[opts.stampType].push(anchor)
            console.log(opts.stampType, room.memory.stampAnchors[opts.stampType])
            room.memory.stampAnchors[opts.stampType].push(pack(anchor))

            // Loop through structure types in fastFiller structures

            for (const structureType in stamp.structures) {

                // Get the positions for this structre type

                const positions = stamp.structures[structureType]

                // Loop through positions

                for (const pos of positions) {

                    // Re-assign the pos's x and y to align with the offset

                    const x = pos.x + anchor.x - stamp.offset,
                    y = pos.y + anchor.y - stamp.offset

                    // Plan for the structureType at this position

                    structurePlans.set(x, y, constants.structureTypesByNumber[structureType])

                    // If the structureType is a road

                    if (structureType == STRUCTURE_ROAD) {

                        // Record the position in roadCM and iterate

                        roadCM.set(x, y, 1)
                        continue
                    }

                    // Otherwise record the position as avoid in baseCM and roadCM and iterate

                    baseCM.set(x, y, 255)
                    roadCM.set(x, y, 255)
                }
            }
        }

        return true
    }

    // Try to plan the stamp

    if (!planStamp({
        stampType: 'fastFiller',
        count: 1,
        anchorOrient: avgControllerSourcePos,
        normalDT: true,
    })) return false

    // If the stamp failed to be planned

    if (!room.global.stampAnchors.fastFiller?.length) {

        // Record that the room is not claimable and stop

        room.memory.notClaimable = true
        return false
    }

    // Otherwise store the fastFillerAnchor as anchor in the room's memory

    room.memory.anchor = pack(room.global.stampAnchors.fastFiller[0])

    // Get the centerUpgradePos, informing false if it's undefined

    const centerUpgadePos: RoomPosition = room.get('centerUpgradePos')
    if (!centerUpgadePos) return false

    // Get the upgradePositions

    const upgradePositions: RoomPosition[] = room.get('upgradePositions')

    // Loop through each upgradePos

    for (const upgradePos of upgradePositions) {

        // Mark as avoid in road and base cost matrixes

        baseCM.set(upgradePos.x, upgradePos.y, 255)
        roadCM.set(upgradePos.x, upgradePos.y, 20)
    }

    // Try to plan the stamp

    if (!planStamp({
        stampType: 'hub',
        count: 1,
        anchorOrient: room.anchor,
        normalDT: true,
    })) return false

    const fastFillerHubAnchor = findAvgBetweenPosotions(room.global.stampAnchors.fastFiller[0], room.global.stampAnchors.hub[0]),

    // Get the closest upgrade pos and mark it as fair use in roadCM

    closestUpgradePos = room.global.stampAnchors.hub[0].findClosestByRange(upgradePositions)
    roadCM.set(closestUpgradePos.x, closestUpgradePos.y, 5)

    // Construct path

    let path: RoomPosition[] = []

    // Try to plan the stamp

    if(!planStamp({
        stampType: 'extensions',
        count: 7,
        anchorOrient: fastFillerHubAnchor,
    })) return false

    // Plan the stamp x times

    for (const extensionsAnchor of room.global.stampAnchors.extensions) {

        // Path from the extensionsAnchor to the hubAnchor

        path = room.advancedFindPath({
            origin: extensionsAnchor,
            goal: { pos: room.global.stampAnchors.hub[0], range: 2 },
            weightCostMatrixes: [roadCM]
        })

        // Loop through positions of the path

        for (const pos of path) {

            // Record the pos in roadCM

            roadCM.set(pos.x, pos.y, 1)

            // Plan for a road at this position

            structurePlans.set(pos.x, pos.y, constants.structureTypesByNumber[STRUCTURE_ROAD])
        }
    }

    // Try to plan the stamp

    if(!planStamp({
        stampType: 'labs',
        count: 1,
        anchorOrient: fastFillerHubAnchor,
    })) return false

    // Plan roads

    // Path from the fastFillerAnchor to the hubAnchor

    path = room.advancedFindPath({
        origin: room.global.stampAnchors.hub[0],
        goal: { pos: room.anchor, range: 3 },
        weightCostMatrixes: [roadCM]
    })

    // Loop through positions of the path

    for (const pos of path) {

        // Record the pos in roadCM

        roadCM.set(pos.x, pos.y, 1)

        // Plan for a road at this position

        structurePlans.set(pos.x, pos.y, constants.structureTypesByNumber[STRUCTURE_ROAD])
    }

    // Plan for a container at the pos

    /* structurePlans.set(centerUpgadePos.x, centerUpgadePos.y, constants.structureTypesByNumber[STRUCTURE_CONTAINER]) */

    // Path from the hubAnchor to the closestUpgradePos

    path = room.advancedFindPath({
        origin: centerUpgadePos,
        goal: { pos: room.global.stampAnchors.hub[0], range: 2 },
        weightCostMatrixes: [roadCM]
    })

    // Record the path's length in global

    room.global.upgradePathLength = path.length

    // Loop through positions of the path

    for (const pos of path) {

        // Record the pos in roadCM

        roadCM.set(pos.x, pos.y, 1)

        // Plan for a road at this position

        structurePlans.set(pos.x, pos.y, constants.structureTypesByNumber[STRUCTURE_ROAD])
    }

    // Get the room's sourceNames

    const sourceNames: ('source1' | 'source2')[] = ['source1', 'source2']

    // loop through sourceNames

    for (const sourceName of sourceNames) {

        // Get the closestHarvestPos using the sourceName, iterating if undefined

        const closestHarvestPos: RoomPosition | undefined = room.get(`${sourceName}ClosestHarvestPos`)
        if (!closestHarvestPos) continue

        // Record the pos in roadCM

        roadCM.set(closestHarvestPos.x, closestHarvestPos.y, 255)
    }

    // loop through sourceNames

    for (const sourceName of sourceNames) {

        // get the closestHarvestPos using the sourceName, iterating if undefined

        const closestHarvestPos: RoomPosition | undefined = room.get(`${sourceName}ClosestHarvestPos`)
        if (!closestHarvestPos) continue

        // Plan for a road at the pos

        structurePlans.set(closestHarvestPos.x, closestHarvestPos.y, constants.structureTypesByNumber[STRUCTURE_CONTAINER])

        // Path from the fastFillerAnchor to the closestHarvestPos

        path = room.advancedFindPath({
            origin: closestHarvestPos,
            goal: { pos: room.anchor, range: 3 },
            weightCostMatrixes: [roadCM]
        })

        // Record the path's length in global

        room.global[`${sourceName}PathLength`] = path.length

        // Loop through positions of the path

        for (const pos of path) {

            // Record the pos in roadCM

            roadCM.set(pos.x, pos.y, 1)

            // Plan for a road at this position

            structurePlans.set(pos.x, pos.y, constants.structureTypesByNumber[STRUCTURE_ROAD])
        }

        // Path from the centerUpgradePos to the closestHarvestPos

        /* path = room.advancedFindPath({
            origin: closestHarvestPos,
            goal: { pos: closestUpgradePos, range: 1 },
            weightCostMatrixes: [roadCM]
        })

        // Loop through positions of the path

        for (const pos of path) {

            // Record the pos in roadCM

            roadCM.set(pos.x, pos.y, 1)

            // Plan for a road at this position

            structurePlans.set(pos.x, pos.y, constants.structureTypesByNumber[STRUCTURE_ROAD])
        } */
    }

    // Path from the hubAnchor to the labsAnchor

    path = room.advancedFindPath({
        origin: room.global.stampAnchors.labs[0],
        goal: { pos: room.global.stampAnchors.hub[0], range: 2 },
        weightCostMatrixes: [roadCM]
    })

    // Loop through positions of the path

    for (const pos of path) {

        // Record the pos in roadCM

        roadCM.set(pos.x, pos.y, 1)

        // Plan for a road at this position

        structurePlans.set(pos.x, pos.y, constants.structureTypesByNumber[STRUCTURE_ROAD])
    }

    // Record the pos in roadCM

    roadCM.set(mineralHarvestPos.x, mineralHarvestPos.y, 255)
/*
    // Plan for a road at the pos

    structurePlans.set(mineralHarvestPos.x, mineralHarvestPos.y, constants.structureTypesByNumber[STRUCTURE_CONTAINER])
 */
    // Path from the hubAnchor to the mineralHarvestPos

    path = room.advancedFindPath({
        origin: mineralHarvestPos,
        goal: { pos: room.global.stampAnchors.hub[0], range: 2 },
        weightCostMatrixes: [roadCM]
    })

    // Loop through positions of the path

    for (const pos of path) {

        // Record the pos in roadCM

        roadCM.set(pos.x, pos.y, 1)

        // Plan for a road at this position

        structurePlans.set(pos.x, pos.y, constants.structureTypesByNumber[STRUCTURE_ROAD])
    }

    // Otherwise get the mineral

    const mineral: Mineral = room.get('mineral')

    // Plan for a road at the mineral's pos

    structurePlans.set(mineral.pos.x, mineral.pos.y, constants.structureTypesByNumber[STRUCTURE_EXTRACTOR])

    // Record road plans in the baseCM

    // Iterate through each x and y in the room

    for (let x = 0; x < constants.roomDimensions; x++) {
        for (let y = 0; y < constants.roomDimensions; y++) {

            // Get the value of this pos in roadCM, iterate if the value is 0, iterate

            const roadValue = roadCM.get(x, y)
            if (roadValue == 0) continue

            // Otherwise assign 255 to this pos in baseCM

            baseCM.set(x, y, 255)
        }
    }

    // Mark the closestUpgradePos as avoid in the CM

    baseCM.set(closestUpgradePos.x, closestUpgradePos.y, 255)

    // Construct extraExtensions count

    let extraExtensionsAmount = 60 - (5 * 7) - 15

    // Get the room's terrain data

    const terrain = room.getTerrain()

    // loop through sourceNames

    for (const sourceName of sourceNames) {

        // Record that the source has no link

        let sourceHasLink = false

        // Get the closestHarvestPos of this sourceName

        const closestHarvestPos: RoomPosition = room.get(`${sourceName}ClosestHarvestPos`),

        // Find positions adjacent to source

        adjacentPositions = findPositionsInsideRect(closestHarvestPos.x - 1, closestHarvestPos.y - 1, closestHarvestPos.x + 1, closestHarvestPos.y + 1),

        // Sort adjacentPositions by range from the anchor

        adjacentPositionsByAnchorRange = adjacentPositions.sort(function(a, b) {

            return getRange(a.x - room.global.stampAnchors.hub[0].x, a.y - room.global.stampAnchors.hub[0].y) - getRange(b.x - room.global.stampAnchors.hub[0].x, b.y - room.global.stampAnchors.hub[0].y)
        })

        // Loop through each pos

        for (const pos of adjacentPositionsByAnchorRange) {

            // Iterate if plan for pos is in use

            if (roadCM.get(pos.x, pos.y) != 0) continue

            // Iterate if the pos is a wall

            if (terrain.get(pos.x, pos.y) == TERRAIN_MASK_WALL) continue

            // Otherwise

            // Assign 255 to this pos in baseCM

            baseCM.set(pos.x, pos.y, 255)

            // Assign 255 to this pos in roadCM

            roadCM.set(pos.x, pos.y, 255)

            // If there is no planned link for this source, plan one

            if (!sourceHasLink) {

                // Plan for a link at this position

                structurePlans.set(pos.x, pos.y, constants.structureTypesByNumber[STRUCTURE_LINK])

                // Record the link now has a source and iterate

                sourceHasLink = true
                continue
            }

            // Otherwise if there is a link planned for this source

            // Plan for an extension at this position

            structurePlans.set(pos.x, pos.y, constants.structureTypesByNumber[STRUCTURE_EXTENSION])

            // Decrease the extraExtensionsAmount and iterate

            extraExtensionsAmount--
            continue
        }
    }

    // Try to plan the stamp

    if(!planStamp({
        stampType: 'tower',
        count: 6,
        anchorOrient: fastFillerHubAnchor,
        adjacentToRoads: true,
    })) return false

    // Try to plan the stamp

    if(!planStamp({
        stampType: 'extension',
        count: extraExtensionsAmount,
        anchorOrient: room.global.stampAnchors.hub[0],
        adjacentToRoads: true,
    })) return false

    // Try to plan the stamp

    if(!planStamp({
        stampType: 'observer',
        count: 1,
        anchorOrient: fastFillerHubAnchor,
    })) return false

    // Record planning results in the room's global and inform true

    room.global.plannedBase = true
    return true
}
