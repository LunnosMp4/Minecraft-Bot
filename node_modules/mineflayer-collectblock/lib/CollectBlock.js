"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollectBlock = void 0;
const mineflayer_pathfinder_1 = require("mineflayer-pathfinder");
const mineflayer_utils_1 = require("mineflayer-utils");
const Util_1 = require("./Util");
const Inventory_1 = require("./Inventory");
const BlockVeins_1 = require("./BlockVeins");
const Targets_1 = require("./Targets");
const minecraft_data_1 = __importDefault(require("minecraft-data"));
function collectAll(bot, options, cb) {
    const tempEvents = new mineflayer_utils_1.TemporarySubscriber(bot);
    tempEvents.subscribeTo('entityGone', (entity) => {
        options.targets.removeTarget(entity);
    });
    const collectNext = (err) => {
        if (err != null) {
            tempEvents.cleanup();
            cb(err);
            return;
        }
        if (!options.targets.empty) {
            Inventory_1.emptyInventoryIfFull(bot, options.chestLocations, options.itemFilter, (err) => {
                if (err != null) {
                    tempEvents.cleanup();
                    cb(err);
                    return;
                }
                const closest = options.targets.getClosest();
                if (closest == null) {
                    tempEvents.cleanup();
                    cb();
                    return;
                }
                if (closest.constructor.name === 'Block') {
                    collectBlock(bot, closest, options, collectNext);
                }
                else if (closest.constructor.name === 'Entity') {
                    collectItem(bot, closest, options, collectNext);
                }
                else {
                    cb(Util_1.error('UnknownType', `Target ${closest.constructor.name} is not a Block or Entity!`));
                }
            });
        }
        else {
            tempEvents.cleanup();
            cb();
        }
    };
    collectNext();
}
function collectBlock(bot, block, options, cb) {
    // @ts-expect-error
    const pathfinder = bot.pathfinder;
    const goal = new mineflayer_pathfinder_1.goals.GoalGetToBlock(block.position.x, block.position.y, block.position.z);
    pathfinder.setGoal(goal);
    const tempEvents = new mineflayer_utils_1.TemporarySubscriber(bot);
    tempEvents.subscribeTo('goal_reached', () => {
        tempEvents.cleanup();
        mineBlock(bot, block, options, cb);
    });
    tempEvents.subscribeTo('goal_updated', () => {
        tempEvents.cleanup();
        cb(Util_1.error('PathfindingInterrupted', 'Pathfinding interrupted before block reached.'));
    });
    if (!options.ignoreNoPath) {
        tempEvents.subscribeTo('path_update', (results) => {
            if (results.status === 'noPath') {
                tempEvents.cleanup();
                cb(Util_1.error('NoPath', 'No path to target block!'));
            }
        });
    }
}
function mineBlock(bot, block, options, cb) {
    selectBestTool(bot, block, () => {
        // Do nothing if the block is already air
        // Sometimes happens if the block is broken before the bot reaches it
        if (block.type === 0) {
            cb();
            return;
        }
        const tempEvents = new mineflayer_utils_1.TemporarySubscriber(bot);
        tempEvents.subscribeTo('itemDrop', (entity) => {
            if (entity.position.distanceTo(block.position.offset(0.5, 0.5, 0.5)) <= 0.5) {
                options.targets.appendTarget(entity);
            }
        });
        bot.dig(block, (err) => {
            if (err != null) {
                tempEvents.cleanup();
                cb(err);
                return;
            }
            let remainingTicks = 10;
            tempEvents.subscribeTo('physicTick', () => {
                remainingTicks--;
                if (remainingTicks <= 0) {
                    options.targets.removeTarget(block);
                    tempEvents.cleanup();
                    cb();
                }
            });
        });
    });
}
function selectBestTool(bot, block, cb) {
    const options = {
        requireHarvest: true,
        getFromChest: true,
        maxTools: 2
    };
    // @ts-expect-error
    const toolPlugin = bot.tool;
    toolPlugin.equipForBlock(block, options, cb);
}
function collectItem(bot, targetEntity, options, cb) {
    // Don't collect any entities that are marked as 'invalid'
    if (!targetEntity.isValid) {
        cb();
        return;
    }
    const goal = new mineflayer_pathfinder_1.goals.GoalFollow(targetEntity, 0);
    // @ts-expect-error
    const pathfinder = bot.pathfinder;
    pathfinder.setGoal(goal, true);
    const tempEvents = new mineflayer_utils_1.TemporarySubscriber(bot);
    tempEvents.subscribeTo('entityGone', (entity) => {
        if (entity === targetEntity) {
            tempEvents.cleanup();
            cb();
        }
    });
    tempEvents.subscribeTo('goal_updated', (newGoal) => {
        if (newGoal === goal)
            return;
        tempEvents.cleanup();
        cb(Util_1.error('PathfindingInterrupted', 'Pathfinding interrupted before item could be reached.'));
    });
}
/**
 * The collect block plugin.
 */
class CollectBlock {
    /**
       * Creates a new instance of the create block plugin.
       *
       * @param bot - The bot this plugin is acting on.
       */
    constructor(bot) {
        /**
           * A list of chest locations which the bot is allowed to empty their inventory into
           * if it becomes full while the bot is collecting resources.
           */
        this.chestLocations = [];
        /**
           * When collecting items, this filter is used to determine what items should be placed
           * into a chest if the bot's inventory becomes full. By default, returns true for all
           * items except for tools, weapons, and armor.
           *
           * @param item - The item stack in the bot's inventory to check.
           *
           * @returns True if the item should be moved into the chest. False otherwise.
           */
        this.itemFilter = (item) => {
            if (item.name.includes('helmet'))
                return false;
            if (item.name.includes('chestplate'))
                return false;
            if (item.name.includes('leggings'))
                return false;
            if (item.name.includes('boots'))
                return false;
            if (item.name.includes('shield'))
                return false;
            if (item.name.includes('sword'))
                return false;
            if (item.name.includes('pickaxe'))
                return false;
            if (item.name.includes('axe'))
                return false;
            if (item.name.includes('shovel'))
                return false;
            if (item.name.includes('hoe'))
                return false;
            return true;
        };
        this.bot = bot;
        this.targets = new Targets_1.Targets(bot);
        this.movements = new mineflayer_pathfinder_1.Movements(bot, minecraft_data_1.default(bot.version));
    }
    /**
       * If target is a block:
       * Causes the bot to break and collect the target block.
       *
       * If target is an item drop:
       * Causes the bot to collect the item drop.
       *
       * If target is an array containing items or blocks, preforms the correct action for
       * all targets in that array sorting dynamically by distance.
       *
       * @param target - The block(s) or item(s) to collect.
       * @param options - The set of options to use when handling these targets
       * @param cb - The callback that is called finished.
       */
    collect(target, options = {}, cb = () => { }) {
        var _a, _b, _c, _d;
        if (typeof options === 'function') {
            cb = options;
            options = {};
        }
        const optionsFull = {
            append: (_a = options.append) !== null && _a !== void 0 ? _a : false,
            ignoreNoPath: (_b = options.ignoreNoPath) !== null && _b !== void 0 ? _b : false,
            chestLocations: (_c = options.chestLocations) !== null && _c !== void 0 ? _c : this.chestLocations,
            itemFilter: (_d = options.itemFilter) !== null && _d !== void 0 ? _d : this.itemFilter,
            targets: this.targets
        };
        // @ts-expect-error
        const pathfinder = this.bot.pathfinder;
        if (pathfinder == null) {
            cb(Util_1.error('UnresolvedDependency', 'The mineflayer-collectblock plugin relies on the mineflayer-pathfinder plugin to run!'));
            return;
        }
        // @ts-expect-error
        const tool = this.bot.tool;
        if (tool == null) {
            cb(Util_1.error('UnresolvedDependency', 'The mineflayer-collectblock plugin relies on the mineflayer-tool plugin to run!'));
            return;
        }
        if (this.movements != null) {
            pathfinder.setMovements(this.movements);
        }
        const beginCollect = (startNew) => {
            if (Array.isArray(target))
                this.targets.appendTargets(target);
            else
                this.targets.appendTarget(target);
            if (startNew) {
                collectAll(this.bot, optionsFull, (err) => {
                    if (err != null) {
                        // Clear the current task on error, since we can't be sure we cleaned up properly
                        this.targets.clear();
                    }
                    // @ts-expect-error
                    this.bot.emit('collectBlock_finished');
                    cb(err);
                });
            }
        };
        if (!optionsFull.append) {
            this.cancelTask(() => {
                beginCollect(true);
            });
        }
        else {
            beginCollect(this.targets.empty);
        }
    }
    /**
     * Loads all touching blocks of the same type to the given block and returns them as an array.
     * This effectively acts as a flood fill algorithm to retrieve blocks in the same ore vein and similar.
     *
     * @param block - The starting block.
     * @param maxBlocks - The maximum number of blocks to look for before stopping.
     * @param maxDistance - The max distance from the starting block to look.
     * @param floodRadius - The max distance distance from block A to block B to be considered "touching"
     */
    findFromVein(block, maxBlocks = 100, maxDistance = 16, floodRadius = 1) {
        return BlockVeins_1.findFromVein(this.bot, block, maxBlocks, maxDistance, floodRadius);
    }
    /**
     * Cancels the current collection task, if still active.
     *
     * @param cb - The callback to use when the task is stopped.
     */
    cancelTask(cb = () => { }) {
        if (this.targets.empty) {
            cb();
        }
        else {
            // @ts-expect-error
            this.bot.once('collectBlock_finished', cb);
        }
    }
}
exports.CollectBlock = CollectBlock;
