import {
    AllyCreepRequestKeys,
    antifaRoles,
    chant,
    ClaimRequestKeys,
    CombatRequestKeys,
    creepRoles,
    haulerUpdateDefault,
    HaulRequestKeys,
    maxClaimRequestDistance,
    maxCombatDistance,
    maxHaulDistance,
    customColors,
    powerCreepClassNames,
    remoteRoles,
    stamps,
} from './constants'
import {
    advancedFindDistance,
    cleanRoomMemory,
    createPosMap,
    customLog,
    findCarryPartsRequired,
    findClosestRoomName,
    randomTick,
} from './utils'
import { internationalManager, InternationalManager } from './international'
import { globalStatsUpdater, statsManager } from './statsManager'
import { indexOf } from 'lodash'
import { CommuneManager } from 'room/commune/commune'
import { powerCreepClasses } from 'room/creeps/powerCreepClasses'
import { RoomManager } from 'room/room'

class TickConfig {
    public run() {
        // If CPU logging is enabled, get the CPU used at the start

        if (Memory.CPULogging === true) var managerCPUStart = Game.cpu.getUsed()

        this.configGeneral()
        statsManager.internationalPreTick()
        this.configRooms()
        this.configClaimRequests()
        this.configAllyCreepRequests()
        this.configCombatRequests()
        this.configHaulRequests()

        if (Memory.CPULogging === true) {
            const cpuUsed = Game.cpu.getUsed() - managerCPUStart
            customLog('Tick Config', cpuUsed.toFixed(2), {
                textColor: customColors.white,
                bgColor: customColors.lightBlue,
            })
            const statName: InternationalStatNames = 'tccu'
            globalStatsUpdater('', statName, cpuUsed, true)
        }
    }

    private configGeneral() {
        // General

        global.communes = new Set()

        // Chant logic

        if (Memory.creepSay) {
            if (Memory.chantIndex >= chant.length - 1) Memory.chantIndex = 0
            else Memory.chantIndex += 1
        }

        // global

        global.constructionSitesCount = Object.keys(Game.constructionSites).length
        global.logs = ``
    }

    private configRooms() {
        // Configure rooms

        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName]

            room.roomManager = global.roomManagers[room.name]

            if (!room.roomManager) {
                room.roomManager = new RoomManager()
                global.roomManagers[room.name] = room.roomManager
            }

            room.roomManager.update(room)
            room.roomManager.preTickRun()
        }
    }

    private configClaimRequests() {
        let reservedGCL = Game.gcl.level - global.communes.size

        // Subtract the number of claimRequests with responders

        for (const roomName in Memory.claimRequests) {
            if (!Memory.claimRequests[roomName][ClaimRequestKeys.responder]) continue

            reservedGCL -= 1
        }

        const communesForResponding = []

        for (const roomName of global.communes) {
            if (Memory.rooms[roomName].claimRequest) continue

            if (Game.rooms[roomName].energyCapacityAvailable < 650) continue

            const room = Game.rooms[roomName]
            if (!room.structures.spawn.length) continue

            communesForResponding.push(roomName)
        }

        // Assign and abandon claimRequests, in order of score

        for (const roomName of internationalManager.claimRequestsByScore) {
            const request = Memory.claimRequests[roomName]

            if (!request) continue

            if (request[ClaimRequestKeys.abandon] > 0) {
                request[ClaimRequestKeys.abandon] -= 1
                continue
            }

            delete request[ClaimRequestKeys.abandon]

            if (request[ClaimRequestKeys.responder] && global.communes.has(request[ClaimRequestKeys.responder]))
                continue

            if (!Memory.autoClaim) continue

            // If there is not enough reserved GCL to make a new request

            if (reservedGCL <= 0) continue
            if (global.communes.size >= internationalManager.maxCommunes) continue

            // If the requested room is no longer neutral

            const type = Memory.rooms[roomName].T

            if (type !== 'neutral' && type !== 'commune') {
                // Delete the request

                Memory.claimRequests[roomName][ClaimRequestKeys.abandon] = 20000
                continue
            }

            const communeName = findClosestRoomName(roomName, communesForResponding)
            if (!communeName) break

            // Run a more simple and less expensive check, then a more complex and expensive to confirm. If the check fails, abandon the room for some time

            if (
                Game.map.getRoomLinearDistance(communeName, roomName) > maxClaimRequestDistance ||
                advancedFindDistance(communeName, roomName, {
                    typeWeights: {
                        keeper: Infinity,
                        enemy: Infinity,
                        ally: Infinity,
                    },
                }) > maxClaimRequestDistance
            ) {
                Memory.claimRequests[roomName][ClaimRequestKeys.abandon] = 20000
                continue
            }

            // Otherwise assign the request to the room, and record as such in Memory

            Memory.rooms[communeName].claimRequest = roomName
            Memory.claimRequests[roomName][ClaimRequestKeys.responder] = communeName

            reservedGCL -= 1

            communesForResponding.splice(indexOf(communesForResponding, communeName), 1)
        }
    }
    private configAllyCreepRequests() {
        // Decrease abandonment for abandoned allyCreepRequests, and find those that aren't abandon responders

        for (const roomName in Memory.allyCreepRequests) {
            const request = Memory.allyCreepRequests[roomName]

            if (request[AllyCreepRequestKeys.abandon] > 0) {
                request[AllyCreepRequestKeys.abandon] -= 1
                continue
            }

            request[AllyCreepRequestKeys.abandon] = undefined

            if (request[AllyCreepRequestKeys.responder]) continue

            const communes = []

            for (const roomName of global.communes) {
                if (Memory.rooms[roomName].allyCreepRequest) continue

                const room = Game.rooms[roomName]
                if (!room.structures.spawn.length) continue

                communes.push(roomName)
            }

            const communeName = findClosestRoomName(roomName, communes)
            if (!communeName) continue

            const maxRange = 20

            // Run a more simple and less expensive check, then a more complex and expensive to confirm

            if (
                Game.map.getRoomLinearDistance(communeName, roomName) > maxRange ||
                advancedFindDistance(communeName, roomName, {
                    typeWeights: {
                        keeper: Infinity,
                        enemy: Infinity,
                        ally: Infinity,
                    },
                }) > maxRange
            ) {
                request[AllyCreepRequestKeys.abandon] = 20000
                continue
            }

            // Otherwise assign the request to the room, and record as such in Memory

            Memory.rooms[communeName].allyCreepRequest = roomName
            request[AllyCreepRequestKeys.responder] = communeName
        }
    }
    private configCombatRequests() {
        // Assign and decrease abandon for combatRequests

        for (const requestName in Memory.combatRequests) {
            const request = Memory.combatRequests[requestName]

            if (request[CombatRequestKeys.abandon]) request[CombatRequestKeys.abandon] -= 1

            if (request[CombatRequestKeys.responder]) {
                internationalManager.creepsByCombatRequest[requestName] = {}
                for (const role of antifaRoles) internationalManager.creepsByCombatRequest[requestName][role] = []
                request[CombatRequestKeys.quads] = 0
                continue
            }

            if (request[CombatRequestKeys.abandon]) continue

            // Filter communes that don't have the combatRequest target already

            const communes = []

            for (const roomName of global.communes) {
                /* if (Memory.rooms[roomName].combatRequests.includes(requestName)) continue */

                // Ensure the combatRequest isn't responded to by the room the request is for

                if (requestName === roomName) continue

                const room = Game.rooms[roomName]
                if (!room.structures.spawn.length) continue

                // Ensure we aren't responding to too many requests for our energy level

                if (room.storage && room.controller.level >= 4) {
                    if (room.memory.combatRequests.length + 1 >= room.communeManager.maxCombatRequests) continue
                } else {
                    if (room.memory.combatRequests.length + 1 >= room.communeManager.estimatedEnergyIncome / 10)
                        continue
                }

                // Ensure we can afford the creeps required

                const minRangedAttackCost = room.communeManager.findMinRangedAttackCost(
                    request[CombatRequestKeys.minDamage],
                )
                const minMeleeHealCost = room.communeManager.findMinHealCost(
                    request[CombatRequestKeys.minMeleeHeal] + (request[CombatRequestKeys.maxTowerDamage] || 0),
                )
                const minRangedHealCost = room.communeManager.findMinHealCost(request[CombatRequestKeys.minRangedHeal])

                if (minRangedAttackCost + minRangedHealCost > room.energyCapacityAvailable) continue

                const minAttackCost = room.communeManager.findMinMeleeAttackCost(request[CombatRequestKeys.minDamage])
                if (minAttackCost > room.energyCapacityAvailable) continue

                communes.push(roomName)
            }

            const communeName = findClosestRoomName(requestName, communes)
            if (!communeName) continue

            // Run a more simple and less expensive check, then a more complex and expensive to confirm

            if (
                Game.map.getRoomLinearDistance(communeName, requestName) > maxCombatDistance ||
                advancedFindDistance(communeName, requestName, {
                    typeWeights: {
                        keeper: Infinity,
                        enemy: Infinity,
                        ally: Infinity,
                    },
                }) > maxCombatDistance
            ) {
                request[CombatRequestKeys.abandon] = 20000
                continue
            }

            // Otherwise assign the request to the room, and record as such in Memory

            Memory.rooms[communeName].combatRequests.push(requestName)
            request[CombatRequestKeys.responder] = communeName

            internationalManager.creepsByCombatRequest[requestName] = {}
            for (const role of antifaRoles) internationalManager.creepsByCombatRequest[requestName][role] = []
        }
    }

    private configHaulRequests() {
        // Assign and decrease abandon for combatRequests

        for (const requestName in Memory.haulRequests) {
            const request = Memory.haulRequests[requestName]

            if (request[HaulRequestKeys.abandon]) request[HaulRequestKeys.abandon] -= 1

            if (request[HaulRequestKeys.responder]) {
                internationalManager.creepsByHaulRequest[requestName] = []
                continue
            }

            // Filter communes that don't have the combatRequest target already

            const communes = []

            for (const roomName of global.communes) {
                if (Memory.rooms[roomName].haulRequests.includes(requestName)) continue

                const room = Game.rooms[roomName]
                if (!room.structures.spawn.length) continue

                // Ensure we aren't responding to too many requests for our energy level

                if (room.controller.level < 4) continue
                if (!room.storage) continue

                if (
                    room.resourcesInStoringStructures.energy / (20000 + room.controller.level * 1000) <
                    room.memory.haulRequests.length
                )
                    continue

                communes.push(roomName)
            }

            const communeName = findClosestRoomName(requestName, communes)
            if (!communeName) continue

            // Run a more simple and less expensive check, then a more complex and expensive to confirm

            if (
                Game.map.getRoomLinearDistance(communeName, requestName) > maxHaulDistance ||
                advancedFindDistance(communeName, requestName, {
                    typeWeights: {
                        keeper: Infinity,
                        enemy: Infinity,
                        ally: Infinity,
                    },
                }) > maxHaulDistance
            ) {
                request[HaulRequestKeys.abandon] = 20000
                continue
            }

            // Otherwise assign the request to the room, and record as such in Memory

            Memory.rooms[communeName].haulRequests.push(requestName)
            request[HaulRequestKeys.responder] = communeName

            internationalManager.creepsByHaulRequest[requestName] = []
        }
    }
}

export const tickConfig = new TickConfig()
