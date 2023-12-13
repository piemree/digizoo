const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");
const displays = require("displays")();
var robot = require("robotjs");
const { io } = require("socket.io-client");


// const getpid = require('getpid')
// const { spawn } = require("child_process")

const { waitFor } = require("../utils/wait-for");
const { computeRelayConfPath, executeRelayConf } = require("./usb-relay-model");

const { videoHTMLLink, dogHTMLLink, dogMasterHTMLLink, runnerConfsDir } = require("../parameters");
const { Window } = require("win-control");

function createVideoHTMLLink(name, counter, loop, selectedAudio) {
  return `${videoHTMLLink}?video=${encodeURI(name)}&counter=${encodeURI(
    counter
  )}&loop=${loop}&outid=${encodeURI(selectedAudio)}`;
}


async function openVideoInTab(tab, name, counter, loop, selectedAudio) {
  await tab.goto(createVideoHTMLLink(name, counter, loop, selectedAudio), {
    waitUntil: "domcontentloaded",
    timeout: 0,
  });
}

async function openDogHtmlInTab(tab) {
  console.log(dogHTMLLink);
  await tab.goto(dogHTMLLink, {
    waitUntil: "domcontentloaded",
    timeout: 0,
  });
}

async function openDogMasterHtmlInTab(tab) {
  await tab.goto(dogMasterHTMLLink, {
    waitUntil: "domcontentloaded",
    timeout: 0,
  });
}

function computeRunnerPath(name) {
  return path.join(runnerConfsDir, name + ".txt");
}

function parseStr(str) {
  if (!str.startsWith('"'))
    throw new Error(`Invalid text: \`${str}\`. Texts should start with "`);
  if (!str.endsWith('"'))
    throw new Error(`Invalid text: \`${str}\`. Texts should end with "`);

  let result = "";

  for (const char of str) {
    if (char === '"') continue;
    result += char;
  }

  return result;
}

function parseTime(str) {
  let ms = 0;

  if (str.endsWith("s")) {
    ms = Number.parseFloat(str.slice(0, -1)) * 1000;
  } else {
    ms = Number.parseFloat(str);
  }

  if (!isFinite(ms)) {
    throw new Error("Invalid time value: " + ms);
  }

  return ms;
}

function readRunnerCommands(path) {
  const commands = [];

  const content = fs.readFileSync(path, "utf8");
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const normalized = line.trim();
    if (!normalized) continue;
    if (normalized.startsWith("#")) continue;

    const [command, ...params] = normalized.split(" ").map((s) => s.trim());

    if (command === "TOGO" || command === "GOTO") {
      commands.push({
        type: command,
        value: params[0],
      });
      continue;
    }

    if (
      command === "WAIT" ||
      command === "JUMP_VIDEO" ||
      command === "SELECT_SCREEN" ||
      command === "SELECT_BOARD"
    ) {
      commands.push({
        type: command,
        value: parseTime(params[0]),
      });
      continue;
    }

    if ((command === "MAP_SIGNAL", command === "WAIT_RFID")) {
      const map = {};
      const value = parseStr(params[0]);
      const items = value.split(";");

      for (const item of items) {
        const [lhs, rhs] = item.split("=");
        map[lhs] = rhs;
      }

      commands.push({
        type: command,
        value: value,
        map: map,
      });
    }

    if (
      command === "RUN_RELAY" ||
      command === "LOAD_VIDEO" ||
      command === "LOAD_VIDEO_LOOPLESS" ||
      // command === 'EXECUTE_REMOTE_RUNNER' ||
      command === "WAIT_SIGNAL" ||
      command === "SIGNAL" ||
      command === "RUN_RUNNER" ||
      command === "SIGNAL_SERVER" ||
      command === "LOG"
    ) {
      commands.push({
        type: command,
        value: parseStr(params[0]),
        value2: parseInt(params[1]),
      });
      continue;
    }

    if (command === "SELECT_AUDIO") {
      commands.push({
        type: command,
        value: parseStr(params[0]),
      });
      continue;
    }
    if (command === "LOAD_DOG_HTML" || "LOAD_DOG_MASTER_HTML") {
      commands.push({
        type: command
      });
      continue;
    }
    if (
      command === "PLAY_VIDEO" ||
      command === "PAUSE_VIDEO" ||
      command === "START_BROWSER" ||
      command === "FOCUS_BROWSER" ||
      command === "RESTART"
    ) {
      commands.push({
        type: command,
      });
      continue;
    }
  }

  return commands;
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

// let BROWSERS = []

// async function killAllChromee() {
//     for (const browser of BROWSERS) {
//         if (browser) {
//             await browser.close()
//         }
//     }

//     BROWSERS = []
//     // spawn('powershell.exe', [`. "${KillChromeeScriptPath}";`])
//     // await waitFor(1000)
// }

async function setFore(pid) {
  Window.getByPid(pid).setForeground();
  // spawn('powershell.exe', [`. "${ShowChromeScriptPath}";`])
}

async function launchBrowser(screenIndex = 0) {
  try {
    // retrieve all the PIDs with the name firefox
    // const pidBlacklist = await getpid('firefox')

    const screen = displays.sort((a, b) => a.left - b.left)[screenIndex]; // asc
    if (!screen) throw new Error("Screen not found: " + screenIndex);
    const { top, left } = screen;

    const browser = await puppeteer.launch({
      headless: false,
      product: "chrome",
      executablePath:
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      userDataDir: ".\\UserData" + screenIndex,
      args: [
         "--kiosk",
        "--unsafely-treat-insecure-origin-as-secure",
        "--unsafety-treat-insecure-origin-as-secure",
        "--use-fake-ui-for-media-stream",
        "--start-maximized",
        "--start-fullscreen",
        "--disable-infobars",
        "--disable-web-security",
        "--disable-session-crashed-bubble",
        "--noerrdialogs",
        "--autoplay-policy=no-user-gesture-required",
        `--window-position=${left},${top}`,
      ],
      ignoreDefaultArgs: [
        "--enable-blink-features=IdleDetection",
        "--enable-automation",
      ],
      defaultViewport: null,
    });

    // BROWSERS.push(browser)
    // await waitFor(2000)

    const page = await browser.newPage();

    // const page = (await browser.pages())[0]
    // await page.target().createCDPSession();
    await page.target().createCDPSession();

    // await showChromee()

    // const pids = await getpid('chrome')
    // const pidWhitelist = pids.filter((pid) => !pidBlacklist.includes(pid))

    // for (const pid of pidWhitelist) {
    // await sendToMonitor(pid, screenIndex)
    await setFore(browser.process().pid);
    // }

    // await waitFor(2000)

    return browser;
  } catch (error) {
    console.log(error);
    return launchBrowser(screenIndex);
  }
}

let _sockets = {}; // server -> socket
let _socketsChannels = {
  // server -> channel -> socket
};

async function retrieveAnActiveSocketConnection(
  server = "http://localhost:3000"
) {
  return new Promise((resolve) => {
    if (!_sockets[server]) {
      _sockets[server] = io(server, {
        reconnection: true,
        forceNew: false,
      });
      console.log("[INFO] Created a new socket instance");
    }
    resolve(_sockets[server]);
  });
}

async function waitForSIGNAL(socket, name) {
  await new Promise((resolve) => {
    if (!_socketsChannels[socket]) {
      _socketsChannels[socket] = {};
    }

    const callback = (data) => {
      if (data === name) {
        resolve();
      }
    };

    if (!_socketsChannels[socket]["receive"]) {
      const listener = (data) => {
        if (_socketsChannels[socket]["receive"]) {
          _socketsChannels[socket]["receive"](data);
        }
        // if (data === name) {
        //     console.log("recieved signal",data);
        //     resolve()
        // }
      };

      socket.on("receive", listener);
    }

    _socketsChannels[socket]["receive"] = callback;
  });
}

async function waitForRFID(socket) {
  return await new Promise((resolve) => {
    if (!_socketsChannels[socket]) {
      _socketsChannels[socket] = {};
    }

    const callback = (data) => {
      console.log("callbackherewith", data);
      resolve(data);
    };

    if (!_socketsChannels[socket]["receive_rfid"]) {
      const listener = (data) => {
        console.log("listener-received", data);
        if (_socketsChannels[socket]["receive_rfid"]) {
          _socketsChannels[socket]["receive_rfid"](data);
        }
      };

      socket.on("receive_rfid", listener);
    }

    _socketsChannels[socket]["receive_rfid"] = callback;
  });
}



async function executeRunnerCommands(
  commands,
  GOTO = null,
  selectedScreen = null,
  selectedBoard = null,
  screen2Browser = {},
  screen2Audio = {},
  selectedSocketServer = "http://localhost:3000",
) {
  console.log({ commands });
  for (const command of commands) {
    const { type, value, value2, map } = command;
    const socket = await retrieveAnActiveSocketConnection(selectedSocketServer);

    if (GOTO !== null) {
      if (type === "TOGO") {
        if (value === GOTO) {
          GOTO = null;
          continue;
        }
      } else {
        continue;
      }
    }

    if (type === "RESTART") {
      // await killAllChromee()
      continue;
    }

    if (type === "GOTO") {
      executeRunnerCommands(
        commands,
        value,
        selectedScreen,
        selectedBoard,
        screen2Browser,
        screen2Audio,
        selectedSocketServer
      );
      break;
    }

    if (type === "WAIT") {
      await waitFor(value);
      continue;
    }

    if (type === "WAIT_SIGNAL") {
      console.log("waiting for signal", value);
      await waitForSIGNAL(socket, value);
      continue;
    }

    if (type === "WAIT_RFID") {
      const rfid = await waitForRFID(socket);
      const TOGO = map[rfid];

      executeRunnerCommands(
        commands,
        TOGO,
        selectedScreen,
        selectedBoard,
        screen2Browser,
        screen2Audio,
        selectedSocketServer,
      );
      break;
    }
    console.log(type);
    if (type === "SIGNAL") {
      socket.emit("send", value);
      continue;
    }

    if (type === "LOG") {
      console.log("[RLOG] " + value);
      continue;
    }

    if (type === "SELECT_SCREEN") {
      selectedScreen = value;
      continue;
    }

    if (type === "SELECT_AUDIO") {
      screen2Audio[selectedScreen] = value;
      continue;
    }

    if (type === "SIGNAL_SERVER") {
      selectedSocketServer = value;
      continue;
    }

    if (type === "SELECT_BOARD") {
      selectedBoard = value;
      continue;
    }

    if (type === "START_BROWSER") {
      if (!selectedScreen && selectedScreen !== 0)
        throw new Error("No screen selected");

      if (screen2Browser[selectedScreen]) {
        // there already is an active browser on that screen
        continue;
      }

      const browser = await launchBrowser(selectedScreen);
      screen2Browser[selectedScreen] = browser;
      continue;
    }

    if (type === "RUN_RELAY") {
      executeRelayConf(selectedBoard, computeRelayConfPath(value));
      continue;
    }

    if (type === "RUN_RUNNER") {
      executeRunner(computeRunnerPath(value));
      continue;
    }

    if (type === "LOAD_VIDEO" || type === "LOAD_VIDEO_LOOPLESS") {
      if (!selectedScreen && selectedScreen !== 0)
        throw new Error("No screen selected");
      const browser = screen2Browser[selectedScreen];
      if (!browser) throw new Error("No browser on screen: " + selectedScreen);

      const page = (await browser.pages())[1];
      await openVideoInTab(page, value, value2, type === "LOAD_VIDEO", screen2Audio[selectedScreen] || '');

      // waitFor(1000).then(() => {
      //     page.keyboard.press('r') // play video
      // })

      continue;
    }
    if (type === "LOAD_DOG_HTML") {
      console.log("dog html");
      if (!selectedScreen && selectedScreen !== 0)
        throw new Error("No screen selected");
      const browser = screen2Browser[selectedScreen];
      if (!browser) throw new Error("No browser on screen: " + selectedScreen);

      const page = (await browser.pages())[1];
      await openDogHtmlInTab(page)
      // waitFor(1000).then(() => {
      //     page.keyboard.press('r') // play video
      // })

      continue;
    }
    if (type === "LOAD_DOG_MASTER_HTML") {
      console.log("dog html");
      if (!selectedScreen && selectedScreen !== 0)
        throw new Error("No screen selected");
      const browser = screen2Browser[selectedScreen];
      if (!browser) throw new Error("No browser on screen: " + selectedScreen);

      const page = (await browser.pages())[1];
      await openDogMasterHtmlInTab(page)
      // waitFor(1000).then(() => {
      //     page.keyboard.press('r') // play video
      // })

      continue;
    }
    if (type === "FOCUS_BROWSER") {
      await waitFor(5000);

      const browser = screen2Browser[selectedScreen];
      if (!browser) throw new Error("No browser on screen: " + selectedScreen);

      const page = (await browser.pages())[1];
      await openVideoInTab(page, value, value2, type === "LOAD_VIDEO");

      await page.bringToFront();

      robot.moveMouse(100, 100);
      robot.mouseClick();

      await waitFor(1000);

      const screen = displays.sort((a, b) => a.left - b.left)[0];

      if (screen) {
        robot.moveMouse(0, screen.height);
      }

      continue;
    }

    if (type === "PLAY_VIDEO") {
      if (!selectedScreen && selectedScreen !== 0)
        throw new Error("No screen selected");
      const browser = screen2Browser[selectedScreen];
      if (!browser) throw new Error("No browser on screen: " + selectedScreen);
      const page = (await browser.pages())[1];
      await page.keyboard.press("r");

      continue;
    }

    if (type === "PAUSE_VIDEO") {
      if (!selectedScreen && selectedScreen !== 0)
        throw new Error("No screen selected");
      const browser = screen2Browser[selectedScreen];
      if (!browser) throw new Error("No browser on screen: " + selectedScreen);
      const page = (await browser.pages())[1];

      await page.keyboard.press("p");

      continue;
    }

    if (type === "JUMP_VIDEO") {
      if (!selectedScreen && selectedScreen !== 0)
        throw new Error("No screen selected");
      const browser = screen2Browser[selectedScreen];
      if (!browser) throw new Error("No browser on screen: " + selectedScreen);
      const page = (await browser.pages())[1];

      const toJump = String(value);

      await page.keyboard.press("d");

      for (const char of toJump) {
        await page.keyboard.press(char);
      }

      await page.keyboard.press("j");

      continue;
    }
  }
}

async function executeRunner(path) {
  const commands = readRunnerCommands(path);
  await executeRunnerCommands(commands);
}

module.exports = {
  computeRunnerPath,
  readRunnerCommands,
  executeRunnerCommands,
  executeRunner,
};
