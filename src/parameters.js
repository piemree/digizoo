const path = require('path')

const videoHTML = path.join(__dirname, '../runner_videos/video.html').replaceAll('\\', '/')
const briefEnterHtml = path.join(__dirname, '../runner_videos/brief-enter.html').replaceAll('\\', '/')
module.exports = {
    // localhost: 'http://ionstation:3000',
    SetWindowScriptPath: path.join(__dirname, '../shells/set-window.ps1'),
    videoHTML: videoHTML,
    briefEnterHtml: 'file://' + briefEnterHtml,
    videoHTMLLink: 'file://' + videoHTML,
    runnerConfsDir: path.join(__dirname, '../runner_confs'),
    relayConfsDir: path.join(__dirname, '../relay_confs')
}
