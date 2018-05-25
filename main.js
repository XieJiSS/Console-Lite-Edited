/// <reference path="typings/electron.d.ts" />

const electron = require('electron');
const { powerSaveBlocker, ipcMain, app, protocol, globalShortcut, BrowserWindow } = electron;
const path = require('path');
const tar = require('tar');
const fs = require('fs');
const fstream = require('fstream');
const rimraf = require('rimraf');

const getIpv4 = require('./packages/ipv4/index')
const server = require('./server/server');
const util = require('./util');

const name = 'Console Lite';

let PSB_ID;
let IPV4 = null;

getIpv4().then(ip => {
  IPV4 = ip;
});

app.setName(name);

// Windows, not the OS, but windows
let controller;
let projector;

const controllerOpt = {
  width: 800,
  height: 600,
  frame: false,
  background: '#FFF',
  icon: path.join(__dirname, 'images', 'icon_256x256.png'),
};

const projectorOpt = {
  x: 0,
  y: 0,
  width: 800,
  height: 600,
  frame: false,
  autoHideMenuBar: true,
  show: false,
  icon: path.join(__dirname, 'images', 'icon_256x256.png'),
};

if(util.supportsTitlebarStyle()) {
  controllerOpt.frame = true;
  projectorOpt.frame = true;
  controllerOpt.titleBarStyle = 'hidden';
  projectorOpt.titleBarStyle = 'hidden';
} else if(util.isWindows()) {
  controllerOpt.frame = true;
  projectorOpt.frame = true;
}

function initController() {
  controller = new BrowserWindow(controllerOpt);
  util.applyControllerMenu(controller);
  controller.loadURL(`file://${__dirname}/controller/index.html`);
  if(PSB_ID !== undefined) {
    powerSaveBlocker.stop(PSB_ID);
    PSB_ID = undefined;
  }
  PSB_ID = powerSaveBlocker.start("prevent-display-sleep");
  if(!powerSaveBlocker.isStarted(PSB_ID)) {
    console.log("Failed to start powerSafeBlocker");
  }
  controller.on('closed', () => {
    controller = null;

    /* Close projector as well */
    if(projector) projector.close();
  });
}

function initProjector() {
  // Ensures that previous windows are closed
  if(projector) projector.close();

  const { screen } = require('electron');
  const displays = screen.getAllDisplays();
  let external;

  if(displays.length <= 1) {
    projectorOpt.x = 0;
    projectorOpt.y = 0;
    projector = new BrowserWindow(projectorOpt);
  } else {
    for(let i = 0; i < displays.length; i++) {
      if(displays[i].bounds.x != 0 || displays[i].bounds.y != 0) {
        external = displays[i];
        console.log(`[Proj] external display found, id=${external.id}`);
        break;
      }
    }
    if(external) {
      projectorOpt.x = external.bounds.x;
      projectorOpt.y = external.bounds.y;
      projector = new BrowserWindow(projectorOpt);
    }
  }

  projector.hide();

  projector.webContents.on('dom-ready', ev => {
    // projector.webContents.openDevTools();
    projector.show();
    if(external) {
      console.log(`[Proj] maximizing projector window, id=${external.id}`);
      projector.setFullScreen(true);
      globalShortcut.register('ESC', () => {
        console.log(`[Proj] quitting FullScreen mode, id=${external.id}`);
        projector.setFullScreen(false);
      });
    }
  });
  projector.loadURL(`file://${__dirname}/projector/index.html`);
  util.applyProjectorMenu(projector);

  projector.on('closed', () => {
    projector = null;
    if(controller) controller.webContents.send('projectorClosed');
  });
}

function setupExportHandler() {
  protocol.registerBufferProtocol('clexport', (request, callback) => {
    if(this.serverStarted) return void callback({ error: 'Server is running' });

    const dir = path.join(__dirname, 'server', 'backend', 'storage');

    const buffers = [];
    fstream.Reader({
      path: dir,
      type: 'Directory',
    })
    .pipe(tar.Pack())
    .on('data', (data) => {
      buffers.push(data);
    })
    .on('end', () => {
      callback(Buffer.concat(buffers));
    })
    .on('error', err => callback({ error: err }));
  });
}

app.on('ready', () => {
  setupExportHandler();
  initController();
  globalShortcut.register('CommandOrControl+\\', () => {
    if(controller) controller.focus();
    else initController();
  });

  globalShortcut.register('CommandOrControl+Shift+|', () => {
    if(projector) projector.focus();
    else initProjector();
  });
});

app.on('window-all-closed', () => {
  if(process.platform !== 'darwin') {
    if(PSB_ID !== undefined)
      powerSaveBlocker.stop(PSB_ID);
    app.quit();
  }
});

app.on('activate', () => {
  if(!controller)
    initController();
});

let serverStarted = false;

let passkey;
let idkey;

let shutdown;

ipcMain.on('startServer', (event) => {
  if(serverStarted) {
    event.sender.send('serverCallback', { url: `http://${ IPV4 || 'localhost' }:3066`, passkey, idkey });
    return;
  }

  server((err, pk, ik, sd) => {
    if(err) {
      console.error(err);
      event.sender.send('serverCallback', { error: err });
      return;
    }

    serverStarted = true;
    passkey = pk;
    idkey = ik;
    shutdown = sd;
    event.sender.send('serverCallback', { url: `http://${ IPV4 || 'localhost' }:3066`, passkey, idkey });
  });
});

ipcMain.on('isServerRunning', (event) => {
  event.returnValue = serverStarted;
});

ipcMain.on('openProjector', () => {
  initProjector();
});

ipcMain.on('closeProjector', () => {
  if(projector) projector.close();
});

ipcMain.on('toProjector', (event, data) => {
  if(projector) projector.webContents.send('fromController', data);
});

ipcMain.on('getProjector', (event) => {
  if(!projector) event.returnValue = null;
  else event.returnValue = projector.id;
});

ipcMain.on('projectorInitialized', () => {
  if(controller) controller.webContents.send('projectorReady');
});

ipcMain.on('checkForUpdate', (ev) => {
  util.checkForUpdate().then(([data, ver]) => {
    if(!data) return;
    ev.sender.send('updateAvailable', { detail: data, version: `v${ver[0]}.${ver[1]}.${ver[2]}` });
  }).catch(e => console.error(e.stack));
});

ipcMain.on('doImport', (ev, data) => {
  const targetDir = path.join(__dirname, 'server', 'backend', 'storage');

  rimraf(path.join(targetDir, '*'), (err) => {
    if(err) return void ev.sender.send('importCb', err);
    fs.createReadStream(data)
    .pipe(tar.Extract({
      path: targetDir,
      strip: 1,
    }))
    .on('end', () => ev.sender.send('importCb', null))
    .on('error', err => ev.sender.send('importCb', err));
  });
});

app.on('quit', () => {
  if(serverStarted) shutdown();
});
