const { executeRelayConf } = require('./models/usb-relay-model')

const [,, board, path] = process.argv

const BoardIndex = Number.parseInt(board)
if (!isFinite(BoardIndex)) throw new Error('Invalid board number: ' + board)

async function main() {
    await executeRelayConf(BoardIndex, path)
}

main()
