import { internationalManager } from "./international"
import { customLog } from "./utils"

export enum AllyRequestTypes {
    /**
     * Tell allies to send below a certain amount of resources a room
     */
    resource,
    /**
     * Tell allies to defend a room
     */
    defense,
    /**
     * Tell allies to attack a room
     */
    attack,
    /**
     * No support from this code, I have no clue what this is for
     */
    execute,
    /**
     * Tell allies they should hate a player a specific amount
     */
    hate,
    /**
     * No support from this code, I strongly suggest utilizing resource requests for this cause
     */
    funnel,
    /**
     * Request help in building a room's structures
     */
    build,
}
export const allyRequestTypeKeys = Object.keys(AllyRequestTypes) as unknown as (keyof typeof AllyRequestTypes)[]

export interface AllyRequest {
    requestType: AllyRequestTypes
    roomName?: string
    playerName?: string
    resourceType?: ResourceConstant
    maxAmount?: number
    /**
     * A number representing the need of the request, where 1 is highest and 0 is lowest
     */
    priority: number
    /**
     * The minimum amount of damage a squad needs
     */
    minDamage?: number
    /**
     * The minimum amount of heal a ranged squad needs
     */
    minRangedHeal?: number
    /**
     * The minimum amount of heal a melee squad needs
     */
    minMeleeHeal?: number
    /**
     * How much hate to increase or decrease a player by
     */
    hateAmount?: number
}

/**
 * Contains functions and methods useful for ally trading. Ensure allyTrading in Memory is enabled, as well as no other values or in the designated simpleAlliesSegment before usage
 */
class AllyManager {
    /**
     * An array of the requests you have made this tick
     */
    myRequests: AllyRequest[]

    currentAlly: string

    _allyRequests: Partial<Record<keyof typeof AllyRequestTypes, { [ID: string]: AllyRequest }>>
    get allyRequests() {
        if (this._allyRequests) return this._allyRequests

        this._allyRequests = {}
        for (const key in AllyRequestTypes) this._allyRequests[key as keyof typeof AllyRequestTypes] = {}

        if (!RawMemory.foreignSegment) return this._allyRequests
        if (RawMemory.foreignSegment.username !== this.currentAlly) return this._allyRequests

        let rawAllyRequests: AllyRequest[]

        try {
            rawAllyRequests = JSON.parse(RawMemory.foreignSegment.data)
        }
        catch (err) {
            customLog('Error in getting requests for simpleAllies', this.currentAlly);
            this._allyRequests = {}
        }

        for (const request of rawAllyRequests) {

            this._allyRequests[allyRequestTypeKeys[request.requestType]][internationalManager.newTickID()] = request
        }

        return this._allyRequests
    }

    /**
     * To call before any requests are made. Configures some required values
     */
    tickConfig() {
        if (!Memory.allyTrading) return

        const allyArray = Array.from(Memory.allyPlayers)
        if (!allyArray.length) return

        this.currentAlly = allyArray[Game.time % allyArray.length]
    }

    /**
     * To call after requests have been made, to assign requests to the next ally
     */
    endTickManager() {
        if (!Memory.allyTrading) return

        if (Object.keys(RawMemory.segments).length < 10) {
            // Assign myRequests to the public segment
            RawMemory.segments[Memory.simpleAlliesSegment] = JSON.stringify(this.myRequests || [])
            RawMemory.setPublicSegments([Memory.simpleAlliesSegment])
        }
    }

    requestAttack(
        roomName: string,
        playerName: string,
        minDamage: number = 0,
        minMeleeHeal: number = 0,
        minRangedHeal: number = 0,
        priority: number = 0,
    ) {
        this.myRequests.push({
            requestType: AllyRequestTypes.attack,
            roomName,
            playerName,
            minDamage,
            minMeleeHeal,
            minRangedHeal,
            priority,
        })
    }

    requestDefense(
        roomName: string,
        minDamage: number = 0,
        minMeleeHeal: number = 0,
        minRangedHeal: number = 0,
        priority: number = 0,
    ) {
        this.myRequests.push({
            requestType: AllyRequestTypes.defense,
            roomName,
            minDamage,
            minMeleeHeal,
            minRangedHeal,
            priority,
        })
    }

    requestHate(playerName: string, hateAmount: number, priority: number = 0) {
        this.myRequests.push({
            requestType: AllyRequestTypes.hate,
            playerName,
            hateAmount,
            priority,
        })
    }

    requestResource(roomName: string, resourceType: ResourceConstant, maxAmount: number, priority: number = 0) {
        this.myRequests.push({
            requestType: AllyRequestTypes.resource,
            resourceType,
            maxAmount,
            roomName,
            priority,
        })
    }

    requestBuild(roomName: string, priority: number = 0) {
        this.myRequests.push({
            requestType: AllyRequestTypes.build,
            roomName,
            priority,
        })
    }
}

export const allyManager = new AllyManager()
