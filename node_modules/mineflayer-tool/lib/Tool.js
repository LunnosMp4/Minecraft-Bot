"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tool = exports.error = void 0;
const Inventory_1 = require("./Inventory");
// @ts-expect-error ; nbt has no typescript header
const nbt = __importStar(require("prismarine-nbt"));
function error(name, message) {
    const e = new Error(message);
    e.name = name;
    return e;
}
exports.error = error;
/**
 * The main class object for the tool plugin.
 */
class Tool {
    /**
     * Creates a new tool plugin instance.
     *
     * @param bot - The bot the plugin is running on.
     */
    constructor(bot) {
        /**
         * A list of chest locations that the bot is allowed to retrieve items from
         * when using the "getFromChest" option.
         */
        this.chestLocations = [];
        this.bot = bot;
    }
    /**
     * Gets the number of ticks required to mine the target block with the given item.
     *
     * @param block - The block to test against.
     * @param item - The item to test with.
     *
     * @returns The number of ticks it would take to mine.
     */
    getDigTime(block, item) {
        // @ts-expect-error ; entity effects not in typescript header
        const effects = this.bot.entity.effects;
        const enchants = (item && item.nbt) ? nbt.simplify(item.nbt).Enchantments : [];
        // @ts-expect-error ; enchants/effects not in digTime typescript header
        return block.digTime(item ? item.type : null, false, false, false, enchants, effects);
    }
    /**
     * Gets the item currently in the bot's hand.
     */
    itemInHand() {
        return this.bot.inventory.slots[this.bot.getEquipmentDestSlot('hand')];
    }
    /**
     * Checks if the best item in the item list is faster than the item in
     * the bot's hand.
     *
     * @param block - The block to test against.
     * @param itemList - The item list to test against.
     *
     * @returns True if the items in the list are better. False if they are worse or
     *          equal to what's already in the bot's hand.
     */
    isBetterMiningTool(block, itemList) {
        const item = this.itemInHand();
        if (!item)
            return true;
        if (itemList.indexOf(item) < 0)
            return true;
        return this.getDigTime(block, itemList[0]) < this.getDigTime(block, item);
    }
    /**
     * This function can be used to equip the best tool currently in the bot's
     * inventory for breaking the given block.
     *
     * @param block - The block the bot is attempting to break.
     * @param options - The options to use for equipping the correct tool.
     * @param cb - The callback.
     */
    equipForBlock(block, options = {}, cb = () => { }) {
        let itemList = [...this.bot.inventory.items()];
        // Add an "undefined" item if the bot has empty space in it's inventory.
        if (this.bot.inventory.emptySlotCount() >= 1)
            itemList.unshift(undefined);
        if (options.requireHarvest)
            itemList = itemList.filter(item => block.canHarvest(item ? item.type : null));
        itemList.sort((a, b) => this.getDigTime(block, a) - this.getDigTime(block, b));
        if (itemList.length === 0) {
            if (options.getFromChest) {
                Inventory_1.retrieveTools(this.bot, {
                    toolFilter: Inventory_1.standardToolFilter,
                    chestLocations: this.chestLocations,
                    toolCostFilter: (item) => this.getDigTime(block, item),
                    maxTools: options.maxTools
                }, (err) => {
                    if (err)
                        cb(err);
                    else
                        this.equipForBlock(block, options, cb);
                });
                return;
            }
            if (options.requireHarvest)
                cb(error('NoItem', 'Bot does not have a harvestable tool!'));
            else
                cb();
            return;
        }
        // Don't change item if it has the same performance as the equipped item.
        // Otherwise you just create unneeded equipment calls and can potentially
        // get stuck in an infinite loop in some conditions.
        if (!this.isBetterMiningTool(block, itemList)) {
            cb();
            return;
        }
        const best = itemList[0];
        if (best)
            this.bot.equip(best, 'hand', cb);
        else
            this.bot.unequip('hand', cb);
    }
}
exports.Tool = Tool;
