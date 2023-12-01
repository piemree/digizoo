const puppeteer = require('puppeteer')
const path = require('path');
const fs = require('fs')
const displays = require('displays')()
const getpid = require('getpid')
const { spawn } = require("child_process")
const { io } = require("socket.io-client");

const { waitFor } = require('../utils/wait-for')
const { computeRelayConfPath, executeRelayConf } = require('./usb-relay-model')

const { ShowChromeScriptPath, SetWindowScriptPath, KillChromeeScriptPath, videoHTML, videoHTMLLink, runnerConfsDir } = require('../parameters')
const {Window} = require('win-control')

function createVideoHTMLLink(name, counter) {
    return videoHTMLLink + '?video=' + encodeURI(name) + "&counter=" + encodeURI(counter)
}

async function openVideoInTab(tab, name, counter) {
    await tab.goto(
        createVideoHTMLLink(name, counter),
        { waitUntil: 'domcontentloaded', timeout: 0 }
    )
}

function computeRunnerPath(name) {
    return path.join(runnerConfsDir, name + '.txt')
}

function parseStr(str) {
    if (!str.startsWith('"')) throw new Error(`Invalid text: \`${str}\`. Texts should start with "`)
    if (!str.endsWith('"')) throw new Error(`Invalid text: \`${str}\`. Texts should end with "`)

    let result = ''

    for (const char of str) {
        if (char === '"') continue
        result += char
    }

    return result
}

function parseTime(str) {
    let ms = 0

    if (str.endsWith('s')) {
        ms = Number.parseFloat(str.slice(0, -1)) * 1000
    } else {
        ms = Number.parseFloat(str)
    }

    if (!isFinite(ms)) {
        throw new Error('Invalid time value: ' + ms)
    }

    return ms
}

function readRunnerCommands(path) {
    const commands = []

    const content = fs.readFileSync(path, 'utf8')
    const lines = content.split(/\r?\n/)

    for (const line of lines) {
        const normalized = line.trim()
        if (!normalized) continue
        if (normalized.startsWith('#')) continue

        const [command, ...params] = normalized.split(' ').map(s => s.trim())

        if (
            command === 'TOGO' ||
            command === 'GOTO'
        ) {
            commands.push({
                type: command,
                value: params[0]
            })
            continue
        }

        if (
            command === 'WAIT' ||
            command === 'JUMP_VIDEO' ||
            command === 'SELECT_SCREEN' ||
            command === 'SELECT_BOARD'
        ) {
            commands.push({
                type: command,
                value: parseTime(params[0])
            })
            continue
        }

        // if (command === 'MAP_SIGNAL') {}

        if (
            command === 'RUN_RELAY' ||
            command === 'LOAD_VIDEO' ||
            // command === 'EXECUTE_REMOTE_RUNNER' ||
            command === 'WAIT_SIGNAL' ||
            command === 'SIGNAL' ||
            command === 'RUN_RUNNER' ||
            command === 'SIGNAL_SERVER' ||
            command === 'LOG'
        ) {

            commands.push({
                type: command,
                value: parseStr(params[0]),
                value2: parseInt(params[1])
            })
            continue
        }

        if (
            command === 'PLAY_VIDEO' ||
            command === 'PAUSE_VIDEO' ||
            command === 'START_BROWSER' ||
            command === 'RESTART'
        ) {
            commands.push({
                type: command,
            })
            continue
        }
    }

    return commands
}

// async function sendToMonitor(pid, screenIndex = 0) {
//     await waitFor(300)

//     const screen = displays.sort((a, b) => a.left - b.left)[screenIndex] // asc
//     if (!screen) throw new Error('Screen not found: ' + screenIndex)
//     const { top, left, width, height } = screen

//     spawn('powershell.exe', [
//         `. "${SetWindowScriptPath}";` +
//         `Set-Window -ProcessId ${pid} -X "${left}" -Y "${top}" -Width ${width} -Height ${height}`
//     ])
// }

let BROWSERS = []

async function killAllChromee() {
    for (const browser of BROWSERS) {
        if (browser) {
            await browser.close()
        }
    }

    BROWSERS = []
    // spawn('powershell.exe', [`. "${KillChromeeScriptPath}";`])
    // await waitFor(1000)
}

async function setFore(pid) {
    Window.getByPid(pid).setForeground()
    // spawn('powershell.exe', [`. "${ShowChromeScriptPath}";`])
}

async function launchBrowser(screenIndex = 0) {
    try {
        // retrieve all the PIDs with the name firefox
        const pidBlacklist = await getpid('firefox')

        const screen = displays.sort((a, b) => a.left - b.left)[screenIndex] // asc
        if (!screen) throw new Error('Screen not found: ' + screenIndex)
        const { top, left, width, height } = screen

        const browser = await puppeteer.launch({
            headless: false,
            product: 'chrome',
            executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
            userDataDir: '.\\UserData' + screenIndex,
            args: [
                '--kiosk',
                '--start-maximized',
                '--start-fullscreen',
                '--disable-infobars',
                '--disable-web-security',
                '--disable-session-crashed-bubble',
                '--noerrdialogs',
                '--autoplay-policy=no-user-gesture-required',
                `--window-position=${left},${top}`
            ],
            ignoreDefaultArgs: [
                '--enable-blink-features=IdleDetection',
                '--enable-automation'
            ],
            defaultViewport: null
        })

        // BROWSERS.push(browser)
        // await waitFor(2000)

        const page = await browser.newPage()

        // const page = (await browser.pages())[0]
        // await page.target().createCDPSession();
        await page.target().createCDPSession();

        // await showChromee()

        // const pids = await getpid('chrome')
        // const pidWhitelist = pids.filter((pid) => !pidBlacklist.includes(pid))

        // for (const pid of pidWhitelist) {
            // await sendToMonitor(pid, screenIndex)
        await setFore(browser.process().pid)
        // }

        // await waitFor(2000)

        return browser
    } catch (error) {
        console.log(error)
        return launchBrowser(screenIndex)
    }
}

let _sockets = {} // server -> socket
let _socketConnected = false

async function retrieveAnActiveSocketConnection(server = 'http://localhost:3000') {
    return new Promise((resolve) => {
        if (!_sockets[server]) {
            _sockets[server] = io(server, {
                reconnection: true,
                forceNew: true
            })
            console.log('[INFO] Created a new socket instance')
        }
        resolve(_sockets[server])
    })
}

async function waitForSIGNAL(socket, name) {
    await new Promise(resolve => {
        const listener = socket.on('receive', (data) => {
            if (data === name) {
                // console.log("revieved signal",data);
                socket.off('receive', listener)
                resolve()
            }
        })
    })
}

async function waitForRFID(socket) {
    return new Promise(resolve => {
        const listener = socket.on('receive_rfid', (data) => {
            // console.log('received:', data)
            socket.off('receive_rfid', listener)
            resolve(data)
        })
    })
}

async function executeRunnerCommands(
    commands,
    GOTO = null,
    selectedScreen = null,
    selectedBoard = null,
    screen2Browser = {},
    selectedSocketServer = 'http://localhost:3000'
) {
    for (const command of commands) {
        const { type, value, value2 } = command
        const socket = await retrieveAnActiveSocketConnection(selectedSocketServer)

        if (GOTO !== null) {
            if (type === 'TOGO') {
                if (value === GOTO) {
                    GOTO = null
                    continue
                }
            } else {
                continue
            }
        }

        if (type === 'RESTART') {
            // await killAllChromee()
            continue
        }

        if (type === 'GOTO') {
            executeRunnerCommands(commands, value, selectedScreen, selectedBoard, screen2Browser)
            break
        }

        if (type === 'WAIT') {
            await waitFor(value)
            continue
        }

        if (type === 'WAIT_SIGNAL') {
            await waitForSIGNAL(socket, value)
            continue
        }

        if (type === 'WAIT_RFID') {
            const rfid = await waitForRFID(socket)
            console.log('rfidread:', rfid)
            const TOGO = map[rfid]
            executeRunnerCommands(commands, TOGO, selectedScreen, selectedBoard, screen2Browser, selectedSocketServer)
            break
        }

        if (type === 'SIGNAL') {
            socket.emit('send', value)
            continue
        }

        if (type === 'LOG') {
            console.log('[RLOG] ' + value)
            continue
        }

        if (type === 'SELECT_SCREEN') {
            selectedScreen = value
            continue
        }

        if (type === 'SIGNAL_SERVER') {
            selectedSocketServer = value
            continue
        }

        if (type === 'SELECT_BOARD') {
            selectedBoard = value
            continue
        }

        if (type === 'START_BROWSER') {
            if (!selectedScreen && selectedScreen !== 0) throw new Error('No screen selected')

            if (screen2Browser[selectedScreen]) {
                // there already is an active browser on that screen
                continue
            }

            const browser = await launchBrowser(selectedScreen)
            screen2Browser[selectedScreen] = browser
            continue
        }

        if (type === 'RUN_RELAY') {
            executeRelayConf(selectedBoard, computeRelayConfPath(value))
            continue
        }

        if (type === 'RUN_RUNNER') {
            executeRunner(computeRunnerPath(value))
            continue
        }

        if (type === 'LOAD_VIDEO') {
            if (!selectedScreen && selectedScreen !== 0) throw new Error('No screen selected')
            const browser = screen2Browser[selectedScreen]
            if (!browser) throw new Error('No browser on screen: ' + selectedScreen)
        
            const page = (await browser.pages())[1]
            await openVideoInTab(page, value, value2)

            // waitFor(1000).then(() => {
                //     page.keyboard.press('r') // play video
            // })

            continue
        }

        if (type === 'PLAY_VIDEO') {
            if (!selectedScreen && selectedScreen !== 0) throw new Error('No screen selected')
            const browser = screen2Browser[selectedScreen]
            if (!browser) throw new Error('No browser on screen: ' + selectedScreen)
            const page = (await browser.pages())[1]
            await page.keyboard.press('r')

            continue
        }

        if (type === 'PAUSE_VIDEO') {
            if (!selectedScreen && selectedScreen !== 0) throw new Error('No screen selected')
            const browser = screen2Browser[selectedScreen]
            if (!browser) throw new Error('No browser on screen: ' + selectedScreen)
            const page = (await browser.pages())[1]

            await page.keyboard.press('p')

            continue
        }

        if (type === 'JUMP_VIDEO') {
            if (!selectedScreen && selectedScreen !== 0) throw new Error('No screen selected')
            const browser = screen2Browser[selectedScreen]
            if (!browser) throw new Error('No browser on screen: ' + selectedScreen)
            const page = (await browser.pages())[1]

            const toJump = String(value)

            await page.keyboard.press('d')

            for (const char of toJump) {
                await page.keyboard.press(char)
            }

            await page.keyboard.press('j')

            continue
        }
    }
}

async function executeRunner(path) {
    const commands = readRunnerCommands(path)
    await executeRunnerCommands(commands)
}

module.exports = {
    computeRunnerPath,
    readRunnerCommands,
    executeRunnerCommands,
    executeRunner
}
