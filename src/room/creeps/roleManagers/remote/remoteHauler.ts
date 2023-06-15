import {
    CreepMemoryKeys,
    customColors,
    packedPosLength,
    relayOffsets,
    RESULT_FAIL,
    RoomMemoryKeys,
    RoomTypes,
} from 'international/constants'
import {
    customLog,
    findClosestObject,
    findCoordsInsideRect,
    findFunctionCPU,
    findObjectWithID,
    getRangeXY,
    getRange,
    randomTick,
    randomIntRange,
} from 'international/utils'
import { indexOf } from 'lodash'
import { packCoord, reversePosList, unpackCoord, unpackPos, unpackPosAt } from 'other/codec'
import { creepClasses } from 'room/creeps/creepClasses'
import { Hauler } from '../commune/hauler'

export class RemoteHauler extends Creep {
    public isDying() {
        // Stop if creep is spawning

        if (this.spawning) return false
        /*
        // If the creep's remaining ticks are more than the estimated spawn time, inform false

        if (this.ticksToLive > this.body.length * CREEP_SPAWN_TIME) return false
 */

        if (this.memory[CreepMemoryKeys.remote]) {
            if (
                this.ticksToLive >
                this.body.length * CREEP_SPAWN_TIME +
                    Memory.rooms[this.memory[CreepMemoryKeys.remote]][
                        RoomMemoryKeys.remoteSourcePaths
                    ][this.memory[CreepMemoryKeys.sourceIndex]].length /
                        packedPosLength
            )
                return false
        } else if (this.ticksToLive > this.body.length * CREEP_SPAWN_TIME) return false

        // Record creep as isDying

        return true
    }

    preTickManager() {
        const creepMemory = Memory.creeps[this.name]
        const remoteName = creepMemory[CreepMemoryKeys.remote]
        if (!remoteName) return

        if (randomTick() && !this.getActiveBodyparts(MOVE)) this.suicide()

        if (!this.findRemote()) return
        if (this.isDying()) return

        Memory.rooms[remoteName][RoomMemoryKeys.remoteHaulers][
            creepMemory[CreepMemoryKeys.sourceIndex]
        ] -= this.parts.carry
    }

    hasValidRemote?() {
        const remoteName = Memory.creeps[this.name][CreepMemoryKeys.remote]
        if (!remoteName) return false

        const remoteMemory = Memory.rooms[remoteName]

        if (remoteMemory[RoomMemoryKeys.type] !== RoomTypes.remote) return false
        if (remoteMemory[RoomMemoryKeys.commune] !== this.commune.name) return false
        if (remoteMemory[RoomMemoryKeys.abandon]) return false

        return true
    }

    /**
     * Finds a remote to harvest in
     */
    findRemote?() {
        if (this.hasValidRemote()) return true

        for (const remoteInfo of this.commune.remoteSourceIndexesByEfficacy) {
            const splitRemoteInfo = remoteInfo.split(' ')
            const remoteName = splitRemoteInfo[0]
            const sourceIndex = parseInt(splitRemoteInfo[1]) as 0 | 1
            const remoteMemory = Memory.rooms[remoteName]

            // If there is no need

            if (remoteMemory[RoomMemoryKeys.remoteHaulers][sourceIndex] <= 0) continue

            this.assignRemote(remoteName, sourceIndex)
            return true
        }

        return false
    }

    assignRemote?(remoteName: string, sourceIndex: 0 | 1) {
        this.memory[CreepMemoryKeys.remote] = remoteName
        this.memory[CreepMemoryKeys.sourceIndex] = sourceIndex

        if (this.isDying()) return

        Memory.rooms[remoteName][RoomMemoryKeys.remoteHaulers][
            this.memory[CreepMemoryKeys.sourceIndex]
        ] -= this.parts.carry
    }

    removeRemote?() {
        if (
            !this.isDying &&
            Memory.rooms[this.memory[CreepMemoryKeys.remote]][RoomMemoryKeys.remoteHaulers][
                this.memory[CreepMemoryKeys.sourceIndex]
            ]
        ) {
            ;[RoomMemoryKeys.remoteHaulers][this.memory[CreepMemoryKeys.sourceIndex]]
            Memory.rooms[this.memory[CreepMemoryKeys.remote]][RoomMemoryKeys.remoteHaulers][
                this.memory[CreepMemoryKeys.sourceIndex]
            ] += this.parts.carry
        }

        delete this.memory[CreepMemoryKeys.remote]
        delete this.memory[CreepMemoryKeys.sourceIndex]
    }

    /*
    updateRemote?() {
        if (this.memory[CreepMemoryKeys.remote]) {

            return true
        }

        const remoteNamesByEfficacy = this.commune.remoteNamesBySourceEfficacy

        let roomMemory

        for (const roomName of remoteNamesByEfficacy) {
            roomMemory = Memory.rooms[roomName]

            if (roomMemory.needs[RemoteData.remoteHauler] <= 0) continue

            this.memory[CreepMemoryKeys.remote] = roomName
            roomMemory.needs[RemoteData.remoteHauler] -= this.parts.carry

            return true
        }

        return false
    }
 */

    getResources?() {

        const creepMemory = Memory.creeps[this.name]

        // Try to find a remote

        if (!this.findRemote()) {
            this.message = '❌ Remote'

            if (this.room.name !== this.commune.name) {
                const anchor = this.commune.roomManager.anchor
                if (!anchor) throw Error('no anchor for remoteHarvester')

                if (
                    this.createMoveRequest({
                        origin: this.pos,
                        goals: [
                            {
                                pos: anchor,
                                range: 25,
                            },
                        ],
                    }) === RESULT_FAIL
                ) {
                    creepMemory[CreepMemoryKeys.sleepFor] = 'any'
                    creepMemory[CreepMemoryKeys.sleepTime] = Game.time + randomIntRange(10, 50)
                }
            }

            // If the room is the creep's commune
            /*
            if (this.room.name === this.commune.name) {
                // Advanced recycle and iterate

                this.advancedRecycle()
                return false
            }

            // Otherwise, have the creep make a moveRequest to its commune and iterate

            this.createMoveRequest({
                origin: this.pos,
                goals: [
                    {
                        pos: this.commune.anchor,
                        range: 25,
                    },
                ],
            })
 */
            return false
        }

        // If the creep is in the remote

        if (this.room.name === this.memory[CreepMemoryKeys.remote]) {
            if (!this.getRemoteSourceResources()) return false

            // We have enough resources, return home

            delete this.moved

            this.message += this.commune.name

            const anchor = this.commune.roomManager.anchor
            if (!anchor) throw Error('No anchor for remoteHauler ' + this.room.name)

            this.createMoveRequestByPath(
                {
                    origin: this.pos,
                    goals: [
                        {
                            pos: anchor,
                            range: 3,
                        },
                    ],
                    avoidEnemyRanges: true,
                    typeWeights: {
                        [RoomTypes.enemy]: Infinity,
                        [RoomTypes.ally]: Infinity,
                        [RoomTypes.keeper]: Infinity,
                        [RoomTypes.enemyRemote]: Infinity,
                        [RoomTypes.allyRemote]: Infinity,
                    },
                },
                {
                    packedPath:
                        Memory.rooms[creepMemory[CreepMemoryKeys.remote]][
                            RoomMemoryKeys.remoteSourcePaths
                        ][creepMemory[CreepMemoryKeys.sourceIndex]],
                    remoteName: creepMemory[CreepMemoryKeys.remote],
                },
            )

            return true
        }

        // We aren't in the remote, go to the source

        const sourceHarvestPos = unpackPosAt(
            Memory.rooms[creepMemory[CreepMemoryKeys.remote]][
                RoomMemoryKeys.remoteSourceHarvestPositions
            ][creepMemory[CreepMemoryKeys.sourceIndex]],
        )

        this.message += creepMemory[CreepMemoryKeys.remote]

        this.createMoveRequestByPath(
            {
                origin: this.pos,
                goals: [
                    {
                        pos: sourceHarvestPos,
                        range: 1,
                    },
                ],
                avoidEnemyRanges: true,
                typeWeights: {
                    [RoomTypes.enemy]: Infinity,
                    [RoomTypes.ally]: Infinity,
                    [RoomTypes.keeper]: Infinity,
                    [RoomTypes.enemyRemote]: Infinity,
                    [RoomTypes.allyRemote]: Infinity,
                },
                avoidAbandonedRemotes: true,
            },
            {
                packedPath: reversePosList(
                    Memory.rooms[creepMemory[CreepMemoryKeys.remote]][
                        RoomMemoryKeys.remoteSourcePaths
                    ][creepMemory[CreepMemoryKeys.sourceIndex]],
                ),
                remoteName: creepMemory[CreepMemoryKeys.remote],
            },
        )

        return true
    }

    /**
     *
     * @returns If the creep no longer needs energy
     */
    getRemoteSourceResources?() {
        const creepMemory = Memory.creeps[this.name]
        const sourceHarvestPos = unpackPosAt(
            Memory.rooms[this.room.name][RoomMemoryKeys.remoteSourceHarvestPositions][
                creepMemory[CreepMemoryKeys.sourceIndex]
            ],
        )

        this.room.targetVisual(
            sourceHarvestPos,
            this.room.roomManager.remoteSources[creepMemory[CreepMemoryKeys.sourceIndex]].pos,
            true,
        )

        // If we're ready to take on a request by the source or we already have one, perform it

        const isBySourceHarvestPos = getRange(this.pos, sourceHarvestPos) <= 1
        if (isBySourceHarvestPos || creepMemory[CreepMemoryKeys.roomLogisticsRequests].length > 0) {
            this.runRoomLogisticsRequestsAdvanced({
                types: new Set(['pickup', 'withdraw']),
                resourceTypes: new Set([RESOURCE_ENERGY]),
                conditions: request => {
                    // If the target is near the creep or source

                    const targetPos = findObjectWithID(request.targetID).pos
                    return (
                        getRange(targetPos, this.pos) <= 1 ||
                        getRange(
                            targetPos,
                            this.room.roomManager.remoteSources[
                                creepMemory[CreepMemoryKeys.sourceIndex]
                            ].pos,
                        ) <= 1
                    )
                },
            })

            if (!this.needsResources()) return true
        }

        // Fulfill requests near the hauler

        this.runRoomLogisticsRequestsAdvanced({
            types: new Set(['pickup', 'withdraw']),
            resourceTypes: new Set([RESOURCE_ENERGY]),
            conditions: request => {
                // If the target is near the creep

                const targetPos = findObjectWithID(request.targetID).pos
                return getRange(targetPos, this.pos) <= 1
            },
        })

        if (!this.needsResources()) return true

        // We aren't by the sourceHarvestPos, get adjacent to it

        if (!isBySourceHarvestPos) {
            this.createMoveRequestByPath(
                {
                    origin: this.pos,
                    goals: [
                        {
                            pos: sourceHarvestPos,
                            range: 1,
                        },
                    ],
                    avoidEnemyRanges: true,
                },
                {
                    packedPath: reversePosList(
                        Memory.rooms[this.room.name][RoomMemoryKeys.remoteSourcePaths][
                            creepMemory[CreepMemoryKeys.sourceIndex]
                        ],
                    ),
                    remoteName: this.room.name,
                },
            )

            return false
        }

        // We are next to the source

        this.moved = 'wait'

        return !this.needsResources()
    }

    deliverResources?() {
        if (this.room.name === this.commune.name) {
            // Try to renew the creep

            this.passiveRenew()

            this.runRoomLogisticsRequestsAdvanced({
                types: new Set(['transfer']),
                resourceTypes: new Set([RESOURCE_ENERGY]),
            })

            if (!this.needsResources()) return true

            if (!this.findRemote()) return false

            this.message += this.memory[CreepMemoryKeys.remote]

            const sourceHarvestPos = unpackPosAt(
                Memory.rooms[this.memory[CreepMemoryKeys.remote]][
                    RoomMemoryKeys.remoteSourceHarvestPositions
                ][this.memory[CreepMemoryKeys.sourceIndex]],
            )

            this.createMoveRequestByPath(
                {
                    origin: this.pos,
                    goals: [
                        {
                            pos: sourceHarvestPos,
                            range: 1,
                        },
                    ],
                    avoidEnemyRanges: true,
                    typeWeights: {
                        [RoomTypes.enemy]: Infinity,
                        [RoomTypes.ally]: Infinity,
                        [RoomTypes.keeper]: Infinity,
                        [RoomTypes.enemyRemote]: Infinity,
                        [RoomTypes.allyRemote]: Infinity,
                    },
                },
                {
                    packedPath: reversePosList(
                        Memory.rooms[this.memory[CreepMemoryKeys.remote]][
                            RoomMemoryKeys.remoteSourcePaths
                        ][this.memory[CreepMemoryKeys.sourceIndex]],
                    ),
                    remoteName: this.memory[CreepMemoryKeys.remote],
                },
            )

            return false
        }

        this.message += this.commune.name

        const anchor = this.commune.roomManager.anchor
        if (!anchor) throw Error('No anchor for remoteHauler ' + this.room.name)

        if (!this.hasValidRemote()) return false

        this.createMoveRequestByPath(
            {
                origin: this.pos,
                goals: [
                    {
                        pos: anchor,
                        range: 3,
                    },
                ],
                avoidEnemyRanges: true,
                typeWeights: {
                    [RoomTypes.enemy]: Infinity,
                    [RoomTypes.ally]: Infinity,
                    [RoomTypes.keeper]: Infinity,
                    [RoomTypes.enemyRemote]: Infinity,
                    [RoomTypes.allyRemote]: Infinity,
                },
            },
            {
                packedPath:
                    Memory.rooms[this.memory[CreepMemoryKeys.remote]][
                        RoomMemoryKeys.remoteSourcePaths
                    ][this.memory[CreepMemoryKeys.sourceIndex]],
                loose: true,
            },
        )

        return true
    }

    relayCoord?(coord: Coord) {
        if (Memory.roomVisuals)
            this.room.visual.circle(coord.x, coord.y, { fill: customColors.lightBlue })

        const creepAtPosName = this.room.creepPositions[packCoord(coord)]
        if (!creepAtPosName) return false

        const creepAtPos = Game.creeps[creepAtPosName]

        if (creepAtPos.role !== 'remoteHauler') return false
        if (creepAtPos.movedResource) return false
        if (!creepAtPos.freeNextStore) return false
        if (creepAtPos.freeNextStore !== this.usedNextStore) return false

        this.transfer(creepAtPos, RESOURCE_ENERGY)

        this.movedResource = true
        creepAtPos.movedResource = true
        /*
        const nextEnergy = Math.min(this.nextStore.energy, creepAtPos.freeNextStore)
        this.nextStore.energy -= nextEnergy
        creepAtPos.nextStore.energy += nextEnergy
 */

        customLog('thisEnergy', this.store.energy)
        customLog('creepAtPos Energy', creepAtPos.freeNextStore)
        customLog('nextEnergy', Math.min(this.store.energy, creepAtPos.freeNextStore))

        const nextEnergy = Math.min(this.store.energy, creepAtPos.freeNextStore)
        this.nextStore.energy -= nextEnergy
        creepAtPos.nextStore.energy += nextEnergy

        customLog('this needs res', this.needsResources())
        customLog('creepAtPos need res', creepAtPos.needsResources())

        // Stop previously attempted moveRequests as they do not account for a relay

        delete this.moveRequest
        delete creepAtPos.moveRequest

        delete this.moved
        delete creepAtPos.moved

        // Delete old values

        delete this.memory[CreepMemoryKeys.path]
        delete creepAtPos.memory[CreepMemoryKeys.path]

        // Trade room logistics requests

        creepAtPos.memory[CreepMemoryKeys.roomLogisticsRequests] =
            this.memory[CreepMemoryKeys.roomLogisticsRequests]
        this.memory[CreepMemoryKeys.roomLogisticsRequests] = []

        //

        this.getResources()

        const remoteHauler = creepAtPos as RemoteHauler
        remoteHauler.deliverResources()
        /*
        for (const creep of [this, creepAtPos]) {

            if (creep.moveRequest) {

                const coord = unpackCoord(creep.moveRequest)

                this.room.coordVisual(coord.x, coord.y)
            }
        }
        */

        if (this.moveRequest) this.room.targetVisual(this.pos, unpackCoord(this.moveRequest), true)
        if (creepAtPos.moveRequest)
            creepAtPos.room.targetVisual(creepAtPos.pos, unpackCoord(creepAtPos.moveRequest), true)

        return true
    }

    relayCardinal?(moveCoord: Coord) {
        let offsets = relayOffsets.horizontal
        if (this.pos.y === moveCoord.y) offsets = relayOffsets.vertical

        for (const offset of offsets) {
            const coord = {
                x: moveCoord.x + offset.x,
                y: moveCoord.y + offset.y,
            }

            if (this.relayCoord(coord)) return true
        }

        return false
    }

    relayDiagonal?(moveCoord: Coord) {
        let offsets

        if (this.pos.y > moveCoord.y) {
            offsets = relayOffsets.topLeft
            if (this.pos.x < moveCoord.x) offsets = relayOffsets.topRight
        } else {
            offsets = relayOffsets.bottomLeft
            if (this.pos.x < moveCoord.x) offsets = relayOffsets.bottomRight
        }

        for (const offset of offsets) {
            const coord = {
                x: moveCoord.x + offset.x,
                y: moveCoord.y + offset.y,
            }

            // If the x and y are dissimilar

            if (coord.x !== moveCoord.x && coord.y !== moveCoord.y) continue

            if (this.relayCoord(coord)) return true
        }

        return false
    }

    relay?() {
        // If there is no easy way to know what coord the creep is trying to go to next

        if (
            !this.moveRequest &&
            (!this.memory[CreepMemoryKeys.path] ||
                this.memory[CreepMemoryKeys.path].length / packedPosLength < 2)
        )
            return
        if (this.movedResource) return
        if (!this.nextStore.energy) return

        // Don't relay too close to the source position unless we are fatigued

        if (
            !this.fatigue &&
            this.memory[CreepMemoryKeys.remote] === this.room.name &&
            getRange(
                this.room.roomManager.remoteSourceHarvestPositions[
                    this.memory[CreepMemoryKeys.sourceIndex]
                ][0],
                this.pos,
            ) <= 1
        )
            return

        const moveCoord = this.moveRequest
            ? unpackCoord(this.moveRequest)
            : unpackPosAt(this.memory[CreepMemoryKeys.path], 1)

        if (this.pos.x === moveCoord.x || this.pos.y === moveCoord.y) {
            this.relayCardinal(moveCoord)
            return
        }

        this.relayDiagonal(moveCoord)
    }

    constructor(creepID: Id<Creep>) {
        super(creepID)
    }

    run?() {
        /*
        let returnTripTime = 0
        if (this.memory[CreepMemoryKeys.remote] && this.memory[CreepMemoryKeys.sourceIndex] !== undefined && Memory.rooms[this.memory[CreepMemoryKeys.remote]]) {
            // The 1.1 is to add some margin for the return trip
            if (
                Memory.rooms[this.memory[CreepMemoryKeys.remote]] &&
                Memory.rooms[this.memory[CreepMemoryKeys.remote]][RoomMemoryKeys.remoteSourceHarvestPositions] &&
                Memory.rooms[this.memory[CreepMemoryKeys.remote]][RoomMemoryKeys.remoteSourcePaths].length > this.memory[CreepMemoryKeys.sourceIndex] + 1
            )
                returnTripTime = Memory.rooms[this.memory[CreepMemoryKeys.remote]][RoomMemoryKeys.remoteSourcePaths][this.memory[CreepMemoryKeys.sourceIndex]].length * 1.1
        }
        if (this.ticksToLive <= returnTripTime) this.room.visual.text('🕒', this.pos)
         */

        const creepMemory = Memory.creeps[this.name]

        if (
            creepMemory[CreepMemoryKeys.sleepFor] === 'any' &&
            creepMemory[CreepMemoryKeys.sleepTime] > Game.time
        ) {
            this.message = '😴'
            return
        }

        if (this.needsResources() /*  && this.ticksToLive > returnTripTime */) {
            this.getResources()
            return
        }

        // Otherwise if the creep doesn't need resources

        // If the creep has a remoteName, delete it and delete it's fulfilled needs

        if (this.deliverResources()) this.relay()
    }

    static roleManager(room: Room, creepsOfRole: string[]) {
        for (const creepName of creepsOfRole) {
            const creep = Game.creeps[creepName] as RemoteHauler
            creep.run()
        }
    }
}
