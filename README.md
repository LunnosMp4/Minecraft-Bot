# Minecraft Bot

A Minecraft Bot named Pato who is able to perform actions like a real player.


This bot can be supported on older versions but it is better to play in 1.18.1 or newer.


## Installation

First, install nodeJS:
https://nodejs.org/en/download/


Then open a terminal at the root of the folder and use this command.

On Linux:

```bash
    ./setup/install-mineflayer.sh
```

On Windows - Powershell:

```bash
    ./setup/install-mineflayer.ps1
```
## Connect to a server

```bash
    node pato.js <Name> <IP> <Port>
```

With Port:

```bash
    node pato.js Pato mc.my-server.com 52650
```

Without Port:

```bash
    node pato.js Pato mc.my-server.com
```

On LocalHost:

```bash
    node pato.js Pato Localhost <Port>
```
## In Game

To execute bot commands in game, just write them in the Minecraft chat.
To see all the available commands use the help command.

3 web servers will launch on your localhost:
- http://localhost:3000/ -> Inventory Viewer
- http://localhost:3001/ -> First Person Viewer
- http://localhost:3002/ -> Free Cam Viewer

You can also write Javascript commands from your terminal.

Example :
```JavaScript
    bot.chat("Hello World!")
    bot.chat("/gamemode creative")
    bot.chat("come <Pseudo>")
```
