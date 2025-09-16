const { app, BrowserWindow, ipcMain } = require('electron');
const net = require('net');
const path = require('path');
const say = require('say');

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    fullscreen: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.loadFile('index.html');

  const netServer = net.createServer(socket => {
    socket.on('data', data => {
      const message = data.toString().trim();
      console.log("From Python:", message);

      if (message === 'mic-start') {
        win.webContents.send('mic-state', 'listening');
      } else if (message === 'mic-end') {
        win.webContents.send('mic-state', 'idle');
      } else if (message.startsWith('user:')) {
        const userText = message.substring(5).trim();
        win.webContents.send('mic-user', userText);
      } else if (message.startsWith('bot:')) {
        const botText = message.substring(4).trim();
        win.webContents.send('mic-bot', botText);
        // Speak the bot response
        say.speak(botText, 'Alex', 1.0);  // 'Alex' is a common voice on macOS. Use default on Pi.
      } else {
        win.webContents.send('sensor-state', message);
      }
    });
  });

  netServer.listen(9999, () => {
    console.log("Socket server running on port 9999");
  });
}

app.whenReady().then(createWindow);
