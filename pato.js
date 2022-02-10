/*//*//*//*//*//*//*//*//*//*//*//*/
/*/ Made by Lunnos and Doud Irow /*/
/*//*//*//*//*//*//*//*//*//*//*//*/

const mineflayer = require('mineflayer')
const {vec3} = require('vec3')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const navigatePlugin = require('mineflayer-navigate');
const GoalFollow = goals.GoalFollow
const { GoalNear } = require('mineflayer-pathfinder').goals
const pvp = require('mineflayer-pvp').plugin
const collectBlock = require('mineflayer-collectblock').plugin
const toolPlugin = require('mineflayer-tool').plugin
const armorManager = require('mineflayer-armor-manager')
const inventoryViewer = require('mineflayer-web-inventory')
const autoeat = require("mineflayer-auto-eat")
const { mineflayer: mineflayerViewer } = require('prismarine-viewer')

if (process.argv.length < 2 || process.argv.length > 6) {
    console.log('Usage : node bot.js <name> <host> <password> <port>')
    process.exit(1)
}

const bot = mineflayer.createBot({
    username: process.argv[2] || 'Pato',
    host: process.argv[3],
    port: process.argv[4]
})

bot.loadPlugin(toolPlugin)
bot.loadPlugin(collectBlock)
bot.loadPlugin(armorManager)
bot.loadPlugin(autoeat)
bot.loadPlugin(pathfinder)
bot.loadPlugin(pvp)
bot.loadPlugin(navigatePlugin)

inventoryViewer(bot)

//////////////////////////////// Get Weapons //////////////////////////////////
function getWeapons() {
    const sword = bot.inventory.items().find(item => item.name.includes('sword'))
    if (sword) bot.equip(sword, 'hand')
    const shield = bot.inventory.items().find(item => item.name.includes('shield'))
    if (shield) bot.equip(shield, 'off-hand')
}
///////////////////////////////////////////////////////////////////////////////



//////////////////////////////// Drop Items //////////////////////////////////
function dropItems(args) {
    if (args.length < 2 || args.length > 3) {
        bot.chat("please specify a block")
        return
    }
    const mcData = require('minecraft-data')(bot.version)
    const types = args[1]
    const blockType = mcData.blocksByName[types]
    if (!blockType) {
        const ItemType = mcData.itemsByName[types]
        if (!ItemType) {
            bot.chat(`I don't know any items named ${types}.`)
            return
        }
    }
    if (bot.inventory.items().find(item => item.name.includes(args[1]))) {
        if (!blockType) {
            const ItemType = mcData.itemsByName[types]
            if (!ItemType) {
                return
            }
            bot.chat("I give you this !")
            bot.toss(ItemType.id, null, 1);
        } else {
            bot.chat("I give you this !")
            let count = 1
            bot.toss(blockType.id, null, count);
        }
    } else
        bot.chat("I don't have this item currently!");
}
///////////////////////////////////////////////////////////////////////////////



//////////////////////////////// Random Number //////////////////////////////////
function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}
////////////////////////////////////////////////////////////////////////////////



///////////////////////////////////// Chest ////////////////////////////////////
function sayItems (items = bot.inventory.items()) {
    const output = items.map(itemToString).join(', ')
    if (output) {
      bot.chat(output)
    } else {
      bot.chat('empty')
    }
}

function itemToString (item) {
    if (item) {
      return `${item.name} x ${item.count}`
    } else {
      return '(nothing)'
    }
}

async function watchChest (minecart, blocks = []) {
    const mcData = require('minecraft-data')(bot.version)
    let chestToOpen
    if (minecart) {
      chestToOpen = Object.keys(bot.entities)
        .map(id => bot.entities[id]).find(e => e.entityType === mcData.entitiesByName.chest_minecart &&
        e.objectData.intField === 1 &&
        bot.entity.position.distanceTo(e.position) < 3)
      if (!chestToOpen) {
        bot.chat('no chest minecart found')
        return
      }
    } else {
      chestToOpen = bot.findBlock({
        matching: blocks.map(name => mcData.blocksByName[name].id),
        maxDistance: 64
      })

      if (!chestToOpen) {
        bot.chat('no chest found')
        return
      }
      const p = chestToOpen.position
      const defaultMove = new Movements(bot, mcData)
      bot.pathfinder.setMovements(defaultMove)
      bot.pathfinder.setGoal(new GoalNear(p.x, p.y, p.z, 1))
    }
    const chest = await bot.openChest(chestToOpen)
    sayItems(chest.containerItems())
    chest.on('updateSlot', (slot, oldItem, newItem) => {
      bot.chat(`chest update: ${itemToString(oldItem)} -> ${itemToString(newItem)} (slot: ${slot})`)
    })
    chest.on('close', () => {
      bot.chat('chest closed')
    })
  
    bot.on('chat', onChat)
  
    function onChat (username, message) {
      if (username === bot.username) return
      const command = message.split(' ')
      switch (true) {
        case /^close$/.test(message):
          closeChest()
          break
        case /^take \d+ \w+$/.test(message):
          withdrawItem(command[2], command[1])
          break
        case /^deposit \d+ \w+$/.test(message):
          depositItem(command[2], command[1])
          break
      }
    }
  
    function closeChest () {
      chest.close()
      bot.removeListener('chat', onChat)
    }
  
    async function withdrawItem (name, amount) {
      const item = chest.containerItems().find(item => item.name.includes(name))
      if (item) {
        try {
          await chest.withdraw(item.type, null, amount)
          bot.chat(`withdrew ${amount} ${item.name}`)
        } catch (err) {
          bot.chat(`unable to withdraw ${amount} ${item.name}`)
        }
      } else {
        bot.chat(`unknown item ${name}`)
      }
    }
  
    async function depositItem (name, amount) {
      const item = bot.inventory.items().find(item => item.name.includes(name))
      if (item) {
        try {
          await chest.deposit(item.type, null, amount)
          bot.chat(`deposited ${amount} ${item.name}`)
        } catch (err) {
          bot.chat(`unable to deposit ${amount} ${item.name}`)
        }
      } else {
        bot.chat(`unknown item ${name}`)
      }
    }
}
////////////////////////////////////////////////////////////////////////////////




//////////////////////////////// Protect Function /////////////////////////////
let guardPos = null

function guardArea (pos, args) {
    pos = pos.entity.position
    guardPos = pos.clone();
    if (!bot.pvp.target) {
        if (args.length === 2)
            followPlayer(args[1])
        else {
            moveToGuardPos()
        }
    }

    bot.on('stoppedAttacking', () => {
        if (guardPos) {
            if (args.length === 2)
                followPlayer(args[1])
            else
                moveToGuardPos()
        }
    })
}

function stopGuarding () {
    guardPos = null
    bot.pvp.stop()
    bot.pathfinder.setGoal(null)
}

function moveToGuardPos () {
    const mcData = require('minecraft-data')(bot.version)
    bot.pathfinder.setMovements(new Movements(bot, mcData))
    bot.pathfinder.setGoal(new goals.GoalBlock(guardPos.x, guardPos.y, guardPos.z))
}
///////////////////////////////////////////////////////////////////////////////



//////////////////////////////// Protect Run //////////////////////////////
bot.on('physicTick', () => {
    if (bot.pvp.target) return
    if (bot.pathfinder.isMoving()) return

    const entity = bot.nearestEntity()
    if (entity) bot.lookAt(entity.position.offset(0, entity.height, 0))
})

  bot.on('physicTick', () => {
    if (!guardPos) return

    const filter = e => e.type === 'mob' && e.position.distanceTo(bot.entity.position) < 16 &&
                        e.mobType !== 'Armor Stand' &&
                        e.mobType !== 'Villager' &&
                        e.mobType !== 'Iron Golem' &&
                        e.mobType !== 'Bat'

    const entity = bot.nearestEntity(filter)
    if (entity) {
        getWeapons()
        bot.pvp.attack(entity)
    }
})
///////////////////////////////////////////////////////////////////////////////



//////////////////////////////////// Auto Eat /////////////////////////////////
bot.on("autoeat_started", () => {
    console.log("Auto Eat started!")
})

bot.on("autoeat_stopped", () => {
    getWeapons()
})

bot.on("health", () => {
if (bot.food === 20)
    bot.autoEat.disable()
else bot.autoEat.enable()
})
///////////////////////////////////////////////////////////////////////////////



/////////////////////////////////// When Spawn ////////////////////////////////
bot.once('spawn', () => {
    bot.chat("Hi, I'm Pato, don't call me from too far or I will leave !")
    const mcData = require('minecraft-data')(bot.version)
    const defaultMove = new Movements(bot, mcData)
    bot.autoEat.options.priority = "foodPoints"
    bot.autoEat.options.bannedFood = []
    bot.autoEat.options.eatingTimeout = 3

    bot.autoEat.options = {
        priority: "foodPoints",
        startAt: 14,
        bannedFood: ["golden_apple", "enchanted_golden_apple", "rotten_flesh"],
    }
})
///////////////////////////////////////////////////////////////////////////////


////////////////////////////////// When Collect ///////////////////////////////
let home = null

function moveToHomePos (home) {
    const mcData = require('minecraft-data')(bot.version)
    bot.pathfinder.setMovements(new Movements(bot, mcData))
    bot.pathfinder.setGoal(new goals.GoalBlock(home.x -1, home.y, home.z -1))
}

function collecting(args, username) {
    const mcData = require('minecraft-data')(bot.version)
    const defaultMove = new Movements(bot, mcData)

    let count = 1
    if (args.length === 3) count = parseInt(args[1])
    let type = args[1]
    if (args.length === 3) type = args[2]
    const blockType = mcData.blocksByName[type]
    if (!blockType) {
        bot.chat(`I don't know any blocks named ${type}.`)
        return
    }

    home = bot.players[username].entity.position

    const blocks = bot.findBlocks({
        matching: blockType.id,
        maxDistance: 64,
        count: count
    })

    if (blocks.length === 0) {
        bot.chat("I don't see that block nearby.")
        return
    }

    const targets = []
    for (let i = 0; i < Math.min(blocks.length, count); i++) {
        targets.push(bot.blockAt(blocks[i]))
    }

    bot.chat(`Found ${targets.length} ${type}(s)`)
    bot.collectBlock.collect(targets, err => {
        if (err) {
        bot.chat(err.message)
        console.log(err)
        } else {
        bot.chat('Done')
        moveToHomePos(home)
        }
    })
}

bot.on('chat', (username, message) => {
    const args = message.split(' ')
    if (args[0] !== 'collect') return
    collecting(args, username)
})
///////////////////////////////////////////////////////////////////////////////



//////////////////////////////////// Go Sleep /////////////////////////////////
bot.on('time', () => {
    // We don't want our Bot attacking passive mobs while sleeping
    const filter = e => e.type === 'mob' && e.position.distanceTo(bot.entity.position) < 6 &&
                        e.mobType !== 'Armor Stand' &&
                        e.mobType !== 'Villager' &&
                        e.mobType !== 'Cow' &&
                        e.mobType !== 'Pig' &&
                        e.mobType !== 'Horse' &&
                        e.mobType !== 'Donkey' &&
                        e.mobType !== 'Dolphin' &&
                        e.mobType !== 'Panda' &&
                        e.mobType !== 'Fox' &&
                        e.mobType !== 'Ocelot' &&
                        e.mobType !== 'Sheep' &&
                        e.mobType !== 'Llama' &&
                        e.mobType !== 'Turtle' &&
                        e.mobType !== 'Wolf' &&
                        e.mobType !== 'Squid' &&
                        e.mobType !== 'Rabbit' &&
                        e.mobType !== 'Salmon' &&
                        e.mobType !== 'Pufferfish' &&
                        e.mobType !== 'Parrot' &&
                        e.mobType !== 'Mule' &&
                        e.mobType !== 'Mooshroom' &&
                        e.mobType !== 'Goat' &&
                        e.mobType !== 'Chicken' &&
                        e.mobType !== 'Cat' &&
                        e.mobType !== 'Axolotl' &&
                        e.mobType !== 'Tropical Fish' &&
                        e.mobType !== 'Cod'
    const entity = bot.nearestEntity(filter)
    if (!bot.time.isDay && !bot.isSleeping && !entity)
        goToSleep()
    else if ((bot.time.isDay && bot.isSleeping) || (bot.isSleeping && entity)) {
        wakeUp()
        bot.pvp.attack(entity)
    }
})
  
bot.on('sleep', () => {
    bot.chat('Good night!')
})

bot.on('wake', () => {
    bot.chat('Good morning!')
})
async function goToSleep () {
    const bed = bot.findBlock({
        matching: block => bot.isABed(block)
    })

    if (bed) {
        try {
            await bot.sleep(bed)
            bot.chat("I'm sleeping")
        } catch (err) {}
    }
}

async function wakeUp () {
    try {
        await bot.wake()
    } catch (err) {
        bot.chat(`I can't wake up: ${err.message}`)
    }
}
///////////////////////////////////////////////////////////////////////////////



/////////////////////////////////// On Chat ///////////////////////////////////
bot.on('chat', (username, message) => {
    const mcData = require('minecraft-data')(bot.version)
    const defaultMove = new Movements(bot, mcData)

    const args = message.split(' ')
    if (args.length === 2)
        username = args[1]
    if (username === bot.username) return
    const target = bot.players[username] ? bot.players[username].entity : null
    if (args[0] === 'help') { //help command
        bot.chat('Commands :')
        bot.chat('  come -> El pato comes to you')
        bot.chat('  fight me -> El pato follow you and attack you until your death')
        bot.chat('  follow / flw -> Follow the person')
        bot.chat('  guard -> El pato guard an area')
        bot.chat('  guard [Player] -> El pato protect and follow a player')
        bot.chat('  s[command] -> El pato stop [command]')
        bot.chat('  drop [item] -> Drop [item] from his inventory')
        bot.chat('  stat -> Show Health, Food and XP level of the bot')
        bot.chat('  chest -> Go to nearest and open it')
        bot.chat('  > In chest > close -> Close the chest')
        bot.chat("  > In chest > take [x] [item] -> Withdraw [x] [items] from the chest")
        bot.chat("  > In chest > deposit [x] [item] -> Deposit [x] [items] in the chest")
    } else if (args[0] === 'attack')
        attackEntity()
    else if (args[0] === "follow" || args[0] === "flw") { // START FOLLOW
        followPlayer(username)
    } else if (args[0] === "debug") // DEBUG
        bot.chat("tp" + username)
    else if (args[0] === "sfollow" || args[0] === "sflw") // STOP FOLLOW
        bot.pathfinder.stop()
    else if (args[0] === 'come') // COME TO ME
        comeToMe(username)
    else if (args[0] === 'guard') { // START GUARD
        const player = bot.players[username]
        if (!player) {
          bot.chat("I can't see you.")
          return
        }
        getWeapons()
        if (args.length === 2)
            bot.chat('I will protect this player.')
        else
            bot.chat('I will guard that location.')
        guardArea(player, args)
    } else if (args[0] === 'fight') { // START PVP
        const player = bot.players[username]
        if (!player) {
          bot.chat("I can't see you.")
          return
        }
        bot.chat('Prepare to fight!')
        getWeapons()
        bot.pvp.attack(player.entity)
    } else if (args[0] === 'sguard') { // STOP GUARD
        bot.chat("I'm friendly now !")
        stopGuarding()
    } else if (args[0] === 'sfight') // STOP PVP
        bot.pvp.stop()
    else if (args[0] === 'stat') { // display bot stats
        bot.chat("Health :" + ' ' + bot.health)
        bot.chat("Food :" + ' ' + bot.food)
        bot.chat("XP Levels :" + ' ' + bot.experience.level)
    } else if (args[0] === 'drop') {
        dropItems(args)
    } else if (args[0] === 'chest')
        watchChest(false, ['chest', 'ender_chest', 'trapped_chest'])
    else if (args[0] === 'stop')
        return
})
///////////////////////////////////////////////////////////////////////////////



/////////////////////// Attack Nearly Player////////////////////////
function attackEntity() {
    const entity = bot.nearestEntity()
    if (!entity) {
        bot.chat('No nearby entities')
    } else {
        bot.chat('Attacking ${entity.name ?? entity.username}')
        bot.attack(entity)
    }
}
//////////////////////////////////////////////////////////////////



////////////////////////// Come To Player/////////////////////////
function comeToMe(username) {
    const target = bot.players[username]
    if (!target) {
        bot.chat('I don\'t see you !')
        return
    }
    const mcData = require('minecraft-data')(bot.version)
    const defaultMove = new Movements(bot, mcData)
    bot.pathfinder.setMovements(defaultMove)

    const goal = new GoalFollow(target.entity, 1)
    bot.pathfinder.setGoal(goal, false)
}
//////////////////////////////////////////////////////////////////



////////////////////////// Follow Player//////////////////////////
function followPlayer(username) {
    const playerCI = bot.players[username]

    if (!playerCI) {
        bot.chat('I don\'t see you !')
        return
    }
    const mcData = require('minecraft-data')(bot.version)
    const defaultMove = new Movements(bot, mcData)
    bot.pathfinder.setMovements(defaultMove)

    const goal = new GoalFollow(playerCI.entity, 1)
    bot.pathfinder.setGoal(goal, true)
}
//////////////////////////////////////////////////////////////////

bot.on('kicked', console.log)
bot.on('error', console.log)
bot.on("end", () => bot = createBot());