const path = require('path')

const videoHTML = path.join(__dirname, '../web/video.html').replaceAll('\\', '/')
const dogHTML = path.join(__dirname, '../web/dog.html').replaceAll('\\', '/')
const dogMasterHTML = path.join(__dirname, '../web/dog-master.html').replaceAll('\\', '/')

module.exports = {
    // localhost: 'http://ionstation:3000',
    SetWindowScriptPath: path.join(__dirname, '../shells/set-window.ps1'),
    KillChromeeScriptPath: path.join(__dirname, '../shells/kill-chromee.ps1'),
    ShowChromeScriptPath: path.join(__dirname, '../shells/show-chrome.ps1'),
    videoHTML: videoHTML,
    dogHTML:dogHTML,
    dogMasterHTML:dogMasterHTML,
    videoHTMLLink: 'file://' + videoHTML,
    dogHTMLLink: 'file://' + dogHTML,
    dogMasterHTMLLink: 'file://' + dogMasterHTML,
    runnerConfsDir: path.join(__dirname, '../runner_confs'),
    relayConfsDir: path.join(__dirname, '../relay_confs')
}
