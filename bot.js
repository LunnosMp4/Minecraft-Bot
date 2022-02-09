/*//*//*//*//*//*//*//*//*//*//*//*/
/*/ Made by Lunnos and Doud Irow /*/
/*//*//*//*//*//*//*//*//*//*//*//*/

//const comeToMe = require('./command/come.js')
const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const GoalFollow = goals.GoalFollow
const { GoalNear } = require('mineflayer-pathfinder').goals
const pvp = require('mineflayer-pvp').plugin
const collectBlock = require('mineflayer-collectblock').plugin
const toolPlugin = require('mineflayer-tool').plugin
const armorManager = require('mineflayer-armor-manager')
const inventoryViewer = require('mineflayer-web-inventory')

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
bot.loadPlugin(pathfinder)
bot.loadPlugin(pvp)

inventoryViewer(bot)

//////////////////////////////// Collect Item //////////////////////////////////
bot.on('playerCollect', (collector, itemDrop) => {
    if (collector !== bot.entity) return
    setTimeout(() => {
      const sword = bot.inventory.items().find(item => item.name.includes('sword'))
      if (sword) bot.equip(sword, 'hand')
    }, 150)
})

bot.on('playerCollect', (collector, itemDrop) => {
    if (collector !== bot.entity) return
    setTimeout(() => {
      const shield = bot.inventory.items().find(item => item.name.includes('shield'))
      if (shield) bot.equip(shield, 'off-hand')
    }, 250)
})
///////////////////////////////////////////////////////////////////////////////



//////////////////////////////// Protect Function//////////////////////////////
let guardPos = null

function guardArea (pos) {
  guardPos = pos.clone()

  if (!bot.pvp.target) {
    moveToGuardPos()
  }
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

bot.on('stoppedAttacking', () => {
    if (guardPos) {
      moveToGuardPos()
    }
})
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
                        e.mobType !== 'Armor Stand'

    const entity = bot.nearestEntity(filter)
    if (entity) {
      bot.pvp.attack(entity)
    }
})
///////////////////////////////////////////////////////////////////////////////




/////////////////////////////////// When Spawn ////////////////////////////////
bot.once('spawn', () => {
    const mcData = require('minecraft-data')(bot.version)
    const defaultMove = new Movements(bot, mcData)
})
///////////////////////////////////////////////////////////////////////////////



/////////////////////////////////// On Chat ///////////////////////////////////
bot.on('chat', (username, message) => {
    const mcData = require('minecraft-data')(bot.version)
    const defaultMove = new Movements(bot, mcData)

    const args = message.split(' ')
    if (username === bot.username) return
    const target = bot.players[username] ? bot.players[username].entity : null
    if (args.length === 2)
        username = args[1]
    if (args[0] === 'help') { //help command
        bot.chat('Commands :')
        bot.chat('  Come -> El pato comes to you')
        bot.chat('  Fight me -> El pato follow you and attack you until your death')
        bot.chat('  Follow -> Follow the person')
        bot.chat('  Guard -> El pato attack the nearest entity')
        bot.chat('  s[command]-> El pato stop [command]')
    } else if (args[0] === 'attack')
        attackEntity()
    else if (args[0] === "follow" || args[0] === "flw") // START FOLLOW
        followPlayer(username)
    else if (args[0] === "debug") // DEBUG
        bot.chat(target)
    else if (args[0] === "sfollow" || args[0] === "sflw") // STOP FOLLOW
        bot.pathfinder.stop()
    else if (args[0] === 'come') // COME TO ME
        comeToMe(username)
    else if (args[0] === 'guard') {
        const player = bot.players[username]
        if (!player) {
          bot.chat("I can't see you.")
          return
        }
        bot.chat('I will guard that location.')
        guardArea(player.entity.position)
    } else if (args[0] === 'fight') { // START PVP
        const player = bot.players[username]
        if (!player) {
          bot.chat("I can't see you.")
          return
        }
        bot.chat('Prepare to fight!')
        bot.pvp.attack(player.entity)
      }
      if (args[0] === 'sguard') { // STOP GUARD
        bot.chat("I'm friendly now !")
        stopGuarding()
      } else if (args[0] === 'sfight') // STOP PVP
        bot.pvp.stop()
    else { // START COLLECT BLOCK -> collect <block>
        const args = message.split(' ')


        if (args[0] !== 'collect') return
            let count = 1
        if (args.length === 3) count = parseInt(args[1])
            let type = args[1]
        if (args.length === 3) type = args[2]
            const blockType = mcData.blocksByName[type]
        if (!blockType) {
            bot.chat(`"I don't know any blocks named ${type}.`)
            return
        }

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
            }
        })

    }
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