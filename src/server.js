// server related
const app = require('express')()
const server = require('http').createServer(app)
const io = require('socket.io')(server)

const bodyParser = require('body-parser')
const path = require('path')
const fs = require('fs')

// parameters
const { runnerConfsDir } = require('./parameters')
const { computeRunnerPath, executeRunner } = require('./models/runner-model')

var jsonParser = bodyParser.json()
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*")
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
    next()
})

io.on('connection', (socket) => {
    console.log('[IO] New connection established');

    socket.on('send', (data) => {
        console.log(`[
            IO] Server received and sent the SIGNAL "${data}"`)
        io.sockets.emit('receive', data)
    })
    
    socket.on('disconnect', function () {
      console.log('[IO] Connection closed');
    })
})

// app.get('/relay/retrieve-boards', function (req, res) {
//     // res.json(retrieveRelays())
//     res.json([1, 2, 3])
// })

// app.get('/relay/retrieve-programs', function (req, res) {
//     // read all the conf files
//     const relayConfsDir = path.join(__dirname, '../relay_confs')
//     const files = fs.readdirSync(relayConfsDir)
//     res.json(files)

//     // res.json(['a', 'be', 'cece', 'dea'])
// })


// app.post('/relay/create-program', jsonParser, function (req, res) {
//     const { name, conf } = req.body
//     const relayConfsDir = path.join(__dirname, '../relay_confs')
//     const filePath = path.join(relayConfsDir, name.replace('.txt', '') + '.txt')
//     fs.writeFileSync(filePath, conf)

//     res.json({ success: true })
// })

app.get('/retrieve-runners', (req, res) => {
    const files = fs
        .readdirSync(runnerConfsDir)
        .map((file) => file.replace('.txt', ''))

    res.json(files)
})

app.post('/execute-runner', jsonParser, (req, res) => {
    const { name } = req.body
    executeRunner(computeRunnerPath(name))

    res.json({ success: true })
})

server.listen(3000, () => {
    console.log('[INFO] Server is active on the port 3000')
})
