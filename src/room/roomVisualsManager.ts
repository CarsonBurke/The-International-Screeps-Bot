import { allyList, constants } from 'international/constants'
import { customLog, findObjectWithID } from 'international/generalFunctions'

/**
 * Adds annotations to the room if roomVisuals are enabled
 */
export function roomVisualsManager(room: Room) {
     // Stop if roomVisuals are disabled

     if (!Memory.roomVisuals) return

     // If CPU logging is enabled, get the CPU used at the start

     if (Memory.cpuLogging) var managerCPUStart = Game.cpu.getUsed()

     // If there is an anchor, show a rectangle around it

     if (room.anchor)
          room.visual.rect(room.anchor.x - 0.5, room.anchor.y - 0.5, 1, 1, {
               stroke: constants.colors.lightBlue,
               fill: 'transparent',
          })

     controllerVisuals()

     function controllerVisuals() {
          // Stop if there is no controller

          if (!room.controller) return

          // If the controller is mine

          if (room.controller.my) {
               // If the controller level is less than 8, show percentage to next level

               if (room.controller.level < 8)
                    room.visual.text(
                         `%${((room.controller.progress / room.controller.progressTotal) * 100).toFixed(2)}`,
                         room.controller.pos.x,
                         room.controller.pos.y - 1,
                         {
                              backgroundColor: 'rgb(255, 0, 0, 0)',
                              font: 0.5,
                              opacity: 1,
                              color: constants.colors.lightBlue,
                         },
                    )

               // Show the controller's level

               room.visual.text(`${room.controller.level}`, room.controller.pos, {
                    backgroundColor: 'rgb(255, 0, 0, 0)',
                    font: 0.5,
                    opacity: 0.8,
               })
               return
          }

          // If the controller is reserved

          if (room.controller.reservation) {
               // Define the reservationColor based on some conditions

               const color = reservationColor()

               function reservationColor() {
                    if (room.controller.reservation.username === Memory.me) {
                         return constants.colors.lightBlue
                    }

                    if (allyList.has(room.controller.reservation.username)) {
                         return constants.colors.green
                    }

                    return constants.colors.red
               }

               // Show the reservation time

               room.visual.text(`${room.controller.reservation.ticksToEnd}`, room.controller.pos, {
                    backgroundColor: 'rgb(255, 0, 0, 0)',
                    font: 0.5,
                    opacity: 0.8,
                    color,
               })
          }
     }

     spawnVisuals()

     function spawnVisuals() {
          // Get the spawns in the room

          const spawns: StructureSpawn[] = room.get('spawn')

          // Loop through them

          for (const spawn of spawns) {
               // Iterate if the spawn isn't spawning

               if (!spawn.spawning) continue

               // Get the spawning creep, iterating if it's undefined

               const creep = Game.creeps[spawn.spawning.name]
               if (!creep) continue

               // Otherwise display the role of the creep being spawn

               room.visual.text(creep.memory.role, spawn.pos, {
                    backgroundColor: 'rgb(255, 0, 0, 0)',
                    font: 0.5,
                    opacity: 1,
                    color: constants.colors.lightBlue,
               })

               // And display how many ticks left until spawned

               room.visual.text((spawn.spawning.remainingTime - 1).toString(), spawn.pos.x, spawn.pos.y - 1, {
                    backgroundColor: 'rgb(255, 0, 0, 0)',
                    font: 0.5,
                    opacity: 1,
                    color: constants.colors.lightBlue,
               })
          }
     }

     constructionTargetVisuals()

     function constructionTargetVisuals() {
          // If there is not a cSiteTargetID, stop

          if (!room.memory.cSiteTargetID) return

          // Convert the construction target ID into a game object

          const constructionTarget = findObjectWithID(room.memory.cSiteTargetID)

          // If the constructionTarget exists, show visuals for it

          if (constructionTarget) room.visual.text('🚧', constructionTarget.pos)
     }

    function towerVisuals() {
        //If there is not a tower, stop

        if (!room.memory.towerID) return

        //Convert the tower ID into a game object

        const tower = findObjectWithID(room.memory.towerID)

        //If the tower exists, show visuals for it

        if (tower) room.visual.text('🔫', tower.pos)
    }
    
    function labVisuals() {
        //If there is not a lab, stop

        if (!room.memory.labID) return

        //Convert the lab ID into a game object

        const lab = findObjectWithID(room.memory.labID)

        //If the lab exists, show visuals for it

        if (lab) room.visual.text('🧬', lab.pos)
    }
    
    function factoryVisuals() {
        //If there is not a factory, stop

        if (!room.memory.factoryID) return

        //Convert the factory ID into a game object

        const factory = findObjectWithID(room.memory.factoryID)

        //If the factory exists, show visuals for it

        if (factory) room.visual.text('🏭', factory.pos)
    }
    
    function powerSpawnVisuals() {
        //If there is not a powerSpawn, stop

        if (!room.memory.powerSpawnID) return

        //Convert the powerSpawn ID into a game object

        const powerSpawn = findObjectWithID(room.memory.powerSpawnID)

        //If the powerSpawn exists, show visuals for it

        if (powerSpawn) room.visual.text('📳', powerSpawn.pos)
    }
    
    function nukerVisuals() {
        //If there is not a nuker, stop

        if (!room.memory.nukerID) return

        //Convert the nuker ID into a game object

        const nuker = findObjectWithID(room.memory.nukerID)

        //If the nuker exists, show visuals for it

        if (nuker) room.visual.text('💥', nuker.pos)
    }
    
    function observerVisuals() {
        //If there is not an observer, stop

        if (!room.memory.observerID) return

        //Convert the observer ID into a game object

        const observer = findObjectWithID(room.memory.observerID)

        //If the observer exists, show visuals for it

        if (observer) room.visual.text('📡', observer.pos)
    }
    
    function sourceVisuals() {
        //If there is not a source, stop

        if (!room.memory.sourceID) return

        //Convert the source ID into a game object

        const source = findObjectWithID(room.memory.sourceID)

        //If the source exists, show visuals for it

        if (source) room.visual.text('🌳', source.pos)
    }
    
    function mineralVisuals() {
        //If there is not a mineral, stop

        if (!room.memory.mineralID) return

        //Convert the mineral ID into a game object

        const mineral = findObjectWithID(room.memory.mineralID)

        //If the mineral exists, show visuals for it

        if (mineral) room.visual.text('💎', mineral.pos)
    }

     // If CPU logging is enabled, log the CPU used by this manager

     if (Memory.cpuLogging)
          customLog(
               'Room Visual Manager',
               (Game.cpu.getUsed() - managerCPUStart).toFixed(2),
               undefined,
               constants.colors.lightGrey,
          )
}
