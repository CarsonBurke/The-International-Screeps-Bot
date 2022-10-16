import { myColors, powerCreepClassNames } from 'international/constants'
import { customLog } from 'international/utils'
import { RoomManager } from 'room/roomManager'
import { Operator } from './powerCreeps/operator'

const managers: { [key in PowerClassConstant]: Function } = {
    [POWER_CLASS.OPERATOR]: Operator.operatorManager,
}

export class PowerCreepRoleManager {
    roomManager: RoomManager

    constructor(roomManager: RoomManager) {
        this.roomManager = roomManager
    }

    public run() {
        // If CPU logging is enabled, get the CPU used at the start

        if (Memory.CPULogging) var managerCPUStart = Game.cpu.getUsed()

        for (const className of powerCreepClassNames) this.runManager(className)

        // If CPU logging is enabled, log the CPU used by this manager

        if (Memory.CPULogging)
            customLog(
                'Power Role Manager',
                `CPU: ${(Game.cpu.getUsed() - managerCPUStart).toFixed(2)}, CPU Per Creep: ${(this.roomManager.room
                    .myCreepsAmount
                    ? (Game.cpu.getUsed() - managerCPUStart) / this.roomManager.room.myCreepsAmount
                    : 0
                ).toFixed(2)}`,
                undefined,
                myColors.lightGrey,
            )
    }

    private runManager(className: PowerClassConstant) {
        const roleCPUStart = Game.cpu.getUsed()

        // Get the amount of creeps with the role

        const creepsOfRoleAmount = this.roomManager.room.myPowerCreeps[className].length

        // If there are no creeps for this manager, iterate

        if (!this.roomManager.room.myPowerCreeps[className].length) return

        // Run manager

        try {
            managers[className](this.roomManager.room, this.roomManager.room.myPowerCreeps[className])
        } catch (err) {
            customLog(
                'Exception processing creep role: ' + className + ' in ' + this.roomManager.room.name + '. ',
                err + '\n' + (err as any).stack,
                myColors.white,
                myColors.red,
            )
        }

        // Log className cpu

        customLog(
            `${className}s`,
            `Creeps: ${creepsOfRoleAmount}, CPU: ${(Game.cpu.getUsed() - roleCPUStart).toFixed(2)}, CPU Per Creep: ${(
                (Game.cpu.getUsed() - roleCPUStart) /
                creepsOfRoleAmount
            ).toFixed(2)}`,
            undefined,
        )
    }
}
