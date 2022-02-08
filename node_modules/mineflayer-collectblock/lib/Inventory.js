"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emptyInventory = exports.emptyInventoryIfFull = void 0;
const Util_1 = require("./Util");
const mineflayer_utils_1 = require("mineflayer-utils");
const mineflayer_pathfinder_1 = require("mineflayer-pathfinder");
function getClosestChest(bot, chestLocations) {
    let chest = null;
    let distance = 0;
    for (const c of chestLocations) {
        const dist = c.distanceTo(bot.entity.position);
        if (chest == null || dist < distance) {
            chest = c;
            distance = dist;
        }
    }
    if (chest != null) {
        chestLocations.splice(chestLocations.indexOf(chest), 1);
    }
    return chest;
}
function emptyInventoryIfFull(bot, chestLocations, itemFilter, cb) {
    if (bot.inventory.emptySlotCount() > 0) {
        cb();
        return;
    }
    emptyInventory(bot, chestLocations, itemFilter, cb);
}
exports.emptyInventoryIfFull = emptyInventoryIfFull;
function emptyInventory(bot, chestLocations, itemFilter, cb) {
    if (chestLocations.length === 0) {
        cb(Util_1.error('NoChests', 'There are no defined chest locations!'));
        return;
    }
    // Shallow clone so we can safely remove chests from the list that are full.
    chestLocations = [...chestLocations];
    const tryNextChest = () => {
        const chest = getClosestChest(bot, chestLocations);
        if (chest == null) {
            cb(Util_1.error('NoChests', 'All chests are full.'));
            return;
        }
        tryEmptyInventory(bot, chest, itemFilter, (err, hasRemaining) => {
            if (err != null) {
                cb(err);
                return;
            }
            if (!hasRemaining) {
                cb();
                return;
            }
            tryNextChest();
        });
    };
    tryNextChest();
}
exports.emptyInventory = emptyInventory;
function tryEmptyInventory(bot, chestLocation, itemFilter, cb) {
    gotoChest(bot, chestLocation, (err) => {
        if (err != null) {
            cb(err, true);
            return;
        }
        placeItems(bot, chestLocation, itemFilter, cb);
    });
}
function gotoChest(bot, location, cb) {
    // @ts-expect-error
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
            cb(Util_1.error('NoPath', 'No path to target block!'));
        }
    });
    events.subscribeTo('goal_updated', () => {
        events.cleanup();
        cb(Util_1.error('PathfindingInterrupted', 'Pathfinding interrupted before item could be reached.'));
    });
}
function placeItems(bot, chestPos, itemFilter, cb) {
    const chestBlock = bot.blockAt(chestPos);
    if (chestBlock == null) {
        cb(Util_1.error('UnloadedChunk', 'Chest is in an unloaded chunk!'), true);
        return;
    }
    try {
        const chest = bot.openChest(chestBlock);
        let itemsRemain = false;
        chest.once('open', () => {
            const tryDepositItem = (item, cb) => {
                // @ts-expect-error ; A workaround for checking if the chest is already full
                if (chest.items().length >= chest.window.inventoryStart) {
                    // Mark that we have items that didn't fit.
                    itemsRemain = true;
                    cb();
                    return;
                }
                chest.deposit(item.type, item.metadata, item.count, cb);
            };
            const taskQueue = new mineflayer_utils_1.TaskQueue();
            for (const item of bot.inventory.items()) {
                if (itemFilter(item)) {
                    taskQueue.add(cb => tryDepositItem(item, cb));
                }
            }
            taskQueue.addSync(() => chest.close());
            taskQueue.runAll((err) => {
                if (err != null) {
                    cb(err, true);
                    return;
                }
                cb(undefined, itemsRemain);
            });
        });
    }
    catch (err) {
        // Sometimes open chest will throw a few asserts if block is not a chest
        cb(err, true);
    }
}
