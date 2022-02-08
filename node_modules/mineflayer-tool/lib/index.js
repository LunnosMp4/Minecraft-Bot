"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.plugin = void 0;
const Tool_1 = require("./Tool");
const mineflayer_pathfinder_1 = require("mineflayer-pathfinder");
function plugin(bot) {
    // TODO Replace this with loadPlugin when redundancy protection is in
    setTimeout(() => {
        // @ts-expect-error
        if (!bot.pathfinder)
            bot.loadPlugin(mineflayer_pathfinder_1.pathfinder);
    }, 0);
    // @ts-expect-error
    bot.tool = new Tool_1.Tool(bot);
}
exports.plugin = plugin;
