let findAnchor = require("findAnchor")
let allyList = require("allyList")
require("roomFunctions")

module.exports = {
    run: function(creep) {

        let targetRooms = Game.map.describeExits(creep.room.name)
        let targetRoomsArray = []
        let min
        let targetRoom

        if (!targetRoom) {
            for (let i = 0; i <= 7; i++) {

                let room = targetRooms[i]

                if (room) {

                    if (!Memory.rooms[room]) {

                        Memory.rooms[room] = {}
                    }

                    targetRoomsArray.push(room)
                }
            }

            for (let i = 0; i < targetRoomsArray.length; i++) {
                creep.say("tRA")

                let room = targetRoomsArray[i]

                if (!Memory.rooms[room].scoutTick) {

                    targetRoom = room
                    break
                } else if (i + 1 == targetRoomsArray.length) {

                    min = true
                }
            }

            if (min == true) {
                creep.say("min")

                let targetRoomsArrayScoutTick = []

                for (let room of targetRoomsArray) {

                    targetRoomsArrayScoutTick.push(Memory.rooms[room].scoutTick)
                }

                lowestScoutTick = _.min(targetRoomsArrayScoutTick, function(tick) { return tick })

                for (let room in Memory.rooms) {

                    if (Memory.rooms[room].scoutTick == lowestScoutTick) {

                        targetRoom = room
                        break
                    }
                }
            }
        }

        if (targetRoom) {

            creep.say(targetRoom)

            creep.room.memory.scoutTick = Game.time

            let controller = creep.room.controller

            if (controller) {

                if ((!controller.sign || controller.sign.username != "MarvinTMB") && !controller.reservation && (!controller.owner || controller.owner.username == "MarvinTMB")) {

                    creep.say("Signing")

                    creep.advancedPathing({
                        origin: creep.pos,
                        goal: { pos: controller.pos, range: 1 },
                        plainCost: 1,
                        swampCost: 1,
                        defaultCostMatrix: creep.memory.defaultCostMatrix,
                        avoidStages: [],
                        flee: false,
                        cacheAmount: 50,
                    })

                    if (controller.my) {

                        creep.signController(controller, "A commune of The Internationale. Bourgeoisie not welcome here.")
                    } else {

                        let messages = [
                            "The top 1% have more money than the poorest 4.5 billion",
                            "McDonalds workers in the US make $10/hour. In Denmark, as a result of unions, they make $22/hour",
                            "We have democracy in our policial system, why do we not have it in our companies?",
                            "Workers of the world, unite!",
                            "Real democracy requires democracy in the workplace - Richard Wolff",
                            "Adults spend a combined 13 years of their life under a dictatorship: the workplace",
                        ]

                        let signType = Math.floor(Math.random(messages.length) * 10) - 1

                        creep.signController(controller, messages[signType])
                    }

                } else {

                    if (!controller.my && controller.owner) {
                        if (allyList.indexOf(controller.owner.username.toLowerCase()) >= 0) {

                            creep.room.memory.stage = "allyRoom"
                            creep.room.memory.owner = controller.owner.username
                            creep.room.memory.level = controller.level

                        } else {

                            creep.room.memory.stage = "enemyRoom"
                            creep.room.memory.owner = controller.owner.username
                            creep.room.memory.level = controller.level
                            creep.room.memory.threat = 0

                            /* creep.room.memory.maxRampart = */
                            /* creep.room.memory.towerAmount =  */
                            /* creep.room.memory.spawnAmount =  */
                            /* creep.room.memory.labAmount =  */
                            /* creep.room.memory.storedEnergy =  */
                            /* creep.room.memory.boosts = {attack, rangedAttack, work} */
                        }
                    }

                    if (controller.reservation && controller.reservation.username != "MarvinTMB" && controller.reservation.username != "Invader") {

                        if (allyList.indexOf((controller.reservation.username).toLowerCase()) >= 0) {

                            creep.room.memory.stage = "allyReservation"

                        } else {

                            creep.room.memory.stage = "enemyReservation"
                        }
                    }

                    let targetRoomDistance = Game.map.getRoomLinearDistance(creep.room.name, creep.memory.roomFrom)

                    let goal = _.map([new RoomPosition(25, 25, creep.memory.roomFrom)], function(pos) {
                        return { pos: pos, range: 1 }
                    })

                    if (targetRoomDistance == 1 && !controller.owner && (!controller.reservation || controller.reservation.username == "Invader") && creep.findSafeDistance(creep.pos, goal, ["enemyRoom", "keeperRoom", "enemyReservation"]) <= 2) {

                        function checkDuplicate() {

                            for (let object of Memory.rooms[creep.memory.roomFrom].remoteRooms) {

                                if (object.name == creep.room.name) {

                                    return false
                                }
                            }

                            return true
                        }

                        if (checkDuplicate() && Math.floor(Game.rooms[creep.memory.roomFrom].find(FIND_MY_SPAWNS).length * 2) > Memory.rooms[creep.memory.roomFrom].remoteRooms.length) {

                            let sources = creep.room.find(FIND_SOURCES).length

                            Memory.rooms[creep.memory.roomFrom].remoteRooms.push({ name: creep.room.name, sources: sources, roads: false, builderNeed: false, enemy: false, distance: null })

                            creep.room.memory.stage = "remoteRoom"
                        }
                    } else if (!controller.owner && (!controller.reservation || controller.reservation.username == "Invader") && creep.room.memory.stage != "remoteRoom") {

                        creep.room.memory.stage = "neutralRoom"
                    }

                    let newCommune

                    if (creep.room.find(FIND_SOURCES).length == 2 && Memory.global.communes.length < Game.gcl.level && creep.room.memory.claim != true && creep.room.memory.claim != "notViable" && controller && !controller.owner && !controller.reservation && creep.findSafeDistance(creep.pos, goal, ["enemyRoom", "keeperRoom", "allyRoom"]) <= 10) {

                        if (creep.isEdge()) {

                            creep.advancedPathing({
                                origin: creep.pos,
                                goal: { pos: controller.pos, range: 1 },
                                plainCost: 1,
                                swampCost: 1,
                                defaultCostMatrix: creep.room.memory.defaultCostMatrix,
                                avoidStages: [],
                                flee: false,
                                cacheAmount: 50,
                            })
                        }

                        let nearGhost = false

                        let exits = Game.map.describeExits(creep.room.name)
                        let exitRoomNames = []

                        for (let property in exits) {

                            exitRoomNames.push(exits[property])
                        }

                        for (let roomName of exitRoomNames) {

                            if (Memory.rooms[roomName].owner && Memory.rooms[roomName].owner == "slowmotionghost") nearGhost = true
                        }

                        let nearbyCommunes

                        for (let commune of Memory.global.communes) {

                            let targetRoomDistance = Game.map.getRoomLinearDistance(creep.room.name, commune)

                            if (targetRoomDistance <= 1) {

                                nearbyCommunes = true
                                break
                            }
                        }

                        creep.say("N")

                        if (!nearbyCommunes && !nearGhost) {

                            creep.say("NNC")

                            creep.advancedPathing({
                                origin: creep.pos,
                                goal: { pos: controller.pos, range: 1 },
                                plainCost: 1,
                                swampCost: 1,
                                defaultCostMatrix: creep.room.memory.defaultCostMatrix,
                                avoidStages: [],
                                flee: false,
                                cacheAmount: 50,
                            })

                            if (findAnchor(creep.room)) {

                                creep.say("FA")

                                newCommune = true

                                creep.room.memory.claim = true

                                if (!Memory.global.newCommunes.includes(creep.room.name)) Memory.global.newCommunes.push(creep.room.name)

                            } else {

                                creep.room.memory.claim = "notViable"
                            }
                        } else {

                            creep.room.memory.claim = "notViable"
                        }
                    }

                    if (!newCommune) {

                        creep.advancedPathing({
                            origin: creep.pos,
                            goal: { pos: new RoomPosition(25, 25, targetRoom), range: 1 },
                            plainCost: 1,
                            swampCost: 1,
                            defaultCostMatrix: creep.room.memory.defaultCostMatrix,
                            avoidStages: [],
                            flee: false,
                            cacheAmount: 50,
                        })
                    }
                }
            } else {

                let keeperLair = creep.room.find(FIND_STRUCTURES, {
                    filter: s => s.structureType == STRUCTURE_KEEPER_LAIR
                })

                if (keeperLair.length > 0) {

                    creep.room.memory.stage = "keeperRoom"

                } else {

                    creep.room.memory.stage = "emptyRoom"
                }

                creep.advancedPathing({
                    origin: creep.pos,
                    goal: { pos: new RoomPosition(25, 25, targetRoom), range: 1 },
                    plainCost: 1,
                    swampCost: 1,
                    defaultCostMatrix: false,
                    avoidStages: [],
                    flee: false,
                    cacheAmount: 50,
                })
            }
        }
    }
};