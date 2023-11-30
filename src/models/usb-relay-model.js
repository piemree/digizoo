const USBRelay = require('@josephdadams/usbrelay')
const fs = require('fs')
const { waitFor } = require('../utils/wait-for')
const { relayConfsDir } = require('../parameters')
const path = require('path')

function retrieveRelays() {
    // console.log(USBRelay.Relays)
    // return []
    return USBRelay.Relays.map((relay) => new USBRelay(relay.path))
}

function readRelayConf(path) {
    const result = {} // { GATE: funcs[] }

    const content = fs.readFileSync(path, 'ascii')
    const lines = content.split(/\r?\n/)

    let selectedGate = null

    for (const line of lines) {
        const normalized = line.trim()

        if (!normalized) continue

        const [name, value] = normalized.split(' ').map(s => s.trim())

        if (name === 'FOR') {
            if (!value) throw new Error('Gate number is required')
            if (!result[value]) result[value] = []
            selectedGate = value
            
            continue
        }

        const ms = Number.parseInt(value)

        if (!isFinite(ms)) throw new Error('Invalid miliseconds value: ' + ms)

        if (name === 'OPEN') {
            result[selectedGate].push({
                type: 'OPEN',
                value: ms
            })
            continue
        }

        if (name === 'CLOSE') {
            result[selectedGate].push({
                type: 'CLOSE',
                value: ms
            })
            continue
        }

        throw new Error('Unknown command: ' + name)
    }

    return result
}

async function executeRelayCommands(RELAY, GATE, COMMANDS) {
    // const RelayGate = RELAYS[GATE - 1]
    
    // const chooseBoard = Math.ceil(GATE / 2) - 1
    // const chooseBoardRelay = ((GATE - 1) % 2) + 1

    for (const command of COMMANDS) {
        if (command.type === 'OPEN') {
            await RELAY.setState(GATE, true)
            if (command.value > 0) await waitFor(command.value)
        } else if (command.type === 'CLOSE') {
            await RELAY.setState(GATE, false)
            if (command.value > 0) await waitFor(command.value)
        } else {
            throw new Error('Unknown command type: ' + command.type)
        }
    }
}

async function executeRelayConf(BoardNo, path) {
    const RELAY = retrieveRelays()[BoardNo - 1]
    if (!RELAY) throw new Error(`Board #${BoardNo} can not be found`)

    const GATE2COMMANDS = readRelayConf(path)

    for (const [GATE, COMMANDS] of Object.entries(GATE2COMMANDS)) {
        const normalizedGate = Number.parseInt(GATE)

        if (!normalizedGate) throw new Error('Invalid Gate Value: ' + GATE)

        executeRelayCommands(RELAY, normalizedGate, COMMANDS)
    }
}

function computeRelayConfPath(name) {
    return path.join(relayConfsDir, name + '.txt')
}

module.exports = {
    computeRelayConfPath,
    retrieveRelays,
    readRelayConf,
    executeRelayCommands,
    executeRelayConf
}
