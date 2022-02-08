"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retrieveTools = exports.standardToolFilter = void 0;
const Tool_1 = require("./Tool");
const mineflayer_pathfinder_1 = require("mineflayer-pathfinder");
const mineflayer_utils_1 = require("mineflayer-utils");
/**
 * A standard tool filter that returns true for all tools and false
 * for everything else.
 *
 * @param item - The item to test against.
 */
function standardToolFilter(item) {
    if (item.name.includes('sword'))
        return true;
    if (item.name.includes('pickaxe'))
        return true;
    if (item.name.includes('shovel'))
        return true;
    if (item.name.includes('axe'))
        return true;
    if (item.name.includes('hoe'))
        return true;
    return false;
}
exports.standardToolFilter = standardToolFilter;
/**
 * Moves from chest to chest in an effort to get at least one tool that meets the given requirements.
 * Throws an error in the callback if a tool cannot be retrieved.
 *
 * @param bot - The bot.
 * @param options - The options to use when collecting tools.
 * @param cb - The callback to execute when the function has completed.
 */
function retrieveTools(bot, options, cb) {
    const chestLocations = [...options.chestLocations];
    const tryNextChest = () => {
        const chest = getClosestChest(bot, chestLocations);
        if (!chest) {
            cb(Tool_1.error('NoChest', 'There are no chests with available tools in them!'));
            return;
        }
        chestLocations.splice(chestLocations.indexOf(chest), 1);
        gotoChest(bot, chest, (err) => {
            if (err) {
                cb(err);
                return;
            }
            pullFromChest(bot, chest, options, (gotItem, err) => {
                if (err) {
                    cb(err);
                    return;
                }
                if (gotItem) {
                    cb();
                    return;
                }
                tryNextChest();
            });
        });
    };
    tryNextChest();
}
exports.retrieveTools = retrieveTools;
/**
 * Moves the bot to the chest.
 *
 * @param bot - The bot to move.
 * @param location - The location to move to.
 * @param cb - The callback to run when finished.
 */
function gotoChest(bot, location, cb) {
    // @ts-ignore
    const pathfinder = bot.pathfinder;
    pathfinder.setGoal(new mineflayer_pathfinder_1.goals.GoalBlock(location.x, location.y, location.z));
    const events = new mineflayer_utils_1.TemporarySubscriber(bot);
    events.subscribeTo('goal_reached', () => {
        events.cleanup();
        cb();
    });
    events.subscribeTo('path_update', (results) => {
        if (results.status === 'noPath') {
            events.cleanup();
            cb(Tool_1.error('NoPath', 'No path to target block!'));
        }
    });
    events.subscribeTo('goal_updated', () => {
        events.cleanup();
        cb(Tool_1.error('PathfindingInterrupted', 'Pathfinding interrupted before item could be reached.'));
    });
}
function pullFromChest(bot, chestPos, options, cb) {
    const chestBlock = bot.blockAt(chestPos);
    if (!chestBlock) {
        cb(false, Tool_1.error('UnloadedChunk', 'Chest is located in an unloaded chunk!'));
        return;
    }
    const chest = bot.openChest(chestBlock);
    chest.once('open', () => {
        let itemsToPull = [];
        for (const item of chest.items()) {
            if (options.toolFilter(item))
                itemsToPull.push(item);
        }
        if (itemsToPull.length === 0) {
            cb(false);
            return;
        }
        itemsToPull.sort((a, b) => options.toolCostFilter(a) - options.toolCostFilter(b));
        const maxTools = options.maxTools || 1;
        if (itemsToPull.length > maxTools)
            itemsToPull = itemsToPull.slice(0, maxTools);
        const taskQueue = new mineflayer_utils_1.TaskQueue();
        for (const item of itemsToPull)
            taskQueue.add(cb => chest.withdraw(item.type, item.metadata, item.count, cb));
        taskQueue.addSync(() => chest.close());
        taskQueue.add(cb => setTimeout(cb, 200)); // Wait for server to update inventory
        taskQueue.runAll(err => {
            if (err) {
                cb(false, err);
                return;
            }
            cb(true);
        });
    });
}
/**
 * Gets the location of the nearest chest.
 *
 * @param bot - The bot.
 * @param chestLocations - The list of all chest locations.
 *
 * @returns The nearest chest location, or null if the chest location
 *          array is empty.
 */
function getClosestChest(bot, chestLocations) {
    let location = null;
    let distance = 0;
    for (const chestLocation of chestLocations) {
        const dist = bot.entity.position.distanceTo(chestLocation);
        if (!location || dist < distance) {
            location = chestLocation;
            distance = dist;
        }
    }
    return location;
}
