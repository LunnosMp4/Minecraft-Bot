const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const { GoalNear } = require('mineflayer-pathfinder').goals
const pvp = require('mineflayer-pvp').plugin
const collectBlock = require('mineflayer-collectblock').plugin

if (process.argv.length < 2 || process.argv.length > 6) {
    console.log('Usage : node bot.js <name> <host> <password> <port>')
    process.exit(1)
}

const bot = mineflayer.createBot({
    username: process.argv[2] || 'Pato',
    host: process.argv[3],
    port: process.argv[4]
    //password: process.argv[5],
})

bot.loadPlugin(collectBlock)
bot.loadPlugin(pathfinder)
bot.loadPlugin(pvp)

bot.once('spawn', () => {
    const mcData = require('minecraft-data')(bot.version)
    const defaultMove = new Movements(bot, mcData)
    bot.on('chat', (username, message) => {
        if (username === bot.username) return
            const target = bot.players[username] ? bot.players[username].entity : null
        if (message === 'help') { //help command
            bot.chat('Commands :')
            bot.chat('Attack -> El pato attack the nearest entity')
            bot.chat('Come -> El pato comes to you')
            bot.chat('Fight me -> El pato follow you and attack you until your death')
            bot.chat('stop-> El pato stop fight you')
        } else if (message === 'attack')
            attackEntity()
        else if (message === 'come') { //come command
            comeToMe(target, defaultMove)
        } else if (message === 'fight me') { //fight command
            const player = bot.players[username]
            if (!player) {
              bot.chat("I can\'t see you.")
              return
            }
            bot.pvp.attack(player.entity)
        } else if (message === 'stop') //stop command
            bot.pvp.stop()
        else { //do collector -> collect <block>
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
})

function comeToMe(target, defaultMove) {
    if (!target) {
        bot.chat('I don\'t see you !')
        return
    }
    const p = target.position
    bot.pathfinder.setMovements(defaultMove)
    bot.pathfinder.setGoal(new GoalNear(p.x, p.y, p.z, 1))
}

function attackEntity() {
    const entity = bot.nearestEntity()
    if (!entity) {
        bot.chat('No nearby entities')
    } else {
        bot.chat('Attacking ${entity.name ?? entity.username}')
        bot.attack(entity)
    }
}

bot.on('kicked', console.log)
bot.on('error', console.log)
bot.on("end", () => bot = createBot());