const { readRunnerCommands, executeRunnerCommands } = require('./models/runner-model')

const [,, path] = process.argv

async function main() {
    const commands = readRunnerCommands(path)
    executeRunnerCommands(commands)

    // const page = await browser.newPage()
    // await page.goto('https://example.com' /* , {waitUntil: 'networkidle2'} */)
    // console.log(commands)

}

main()
