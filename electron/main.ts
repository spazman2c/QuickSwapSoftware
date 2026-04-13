import {
  app,
  BrowserWindow,
  desktopCapturer,
  ipcMain,
  screen,
  session,
} from 'electron'
import path from 'node:path'
import os from 'node:os'
import { Discovery } from './discovery'
import { SignalingServer, SignalingClient } from './signaling'
import { InputController } from './input-controller'
import { generateCode, SignalingMessage } from './protocol'

// Enable hardware-accelerated video encode/decode
app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder,VaapiVideoEncoder,WebRTCPipeWireCapturer')
app.commandLine.appendSwitch('enable-gpu-rasterization')
app.commandLine.appendSwitch('disable-frame-rate-limit')
app.commandLine.appendSwitch('disable-gpu-vsync')

let mainWindow: BrowserWindow | null = null
let discovery: Discovery | null = null
let signalingServer: SignalingServer | null = null
let signalingClient: SignalingClient | null = null
let inputController: InputController | null = null

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createWindow(): void {
  const isMac = process.platform === 'darwin'

  mainWindow = new BrowserWindow({
    width: 420,
    height: 580,
    minWidth: 380,
    minHeight: 500,
    frame: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: isMac ? { x: 16, y: 18 } : undefined,
    backgroundColor: '#0D0D0F',
    roundedCorners: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // Auto-grant screen capture without system picker
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 0, height: 0 },
    }).then((sources) => {
      if (sources.length > 0) {
        callback({ video: sources[0] })
      }
    })
  })

  // Disable frame rate limiting for smooth capture
  mainWindow.webContents.setBackgroundThrottling(false)

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  inputController = new InputController()
}

// ── IPC Handlers ──────────────────────────────────────────────────

ipcMain.handle('host-session', async () => {
  const code = generateCode()

  // Start signaling server
  signalingServer = new SignalingServer()
  const port = await signalingServer.start(
    (msg: SignalingMessage) => {
      mainWindow?.webContents.send('signaling-message', msg)
    },
    () => {
      mainWindow?.webContents.send('peer-connected', {
        hostname: 'Remote User',
        platform: 'unknown',
      })
    },
    () => {
      mainWindow?.webContents.send('peer-disconnected')
    }
  )

  // Start LAN discovery broadcast
  discovery = new Discovery()
  await discovery.startBroadcasting(code, port)

  return { code }
})

ipcMain.handle('join-session', async (_event, code: string) => {
  return new Promise((resolve) => {
    discovery = new Discovery()

    const timeout = setTimeout(() => {
      discovery?.stop()
      resolve({ success: false, error: 'No host found with that code' })
    }, 10000)

    discovery.startListening(code, async (host, port, announce) => {
      clearTimeout(timeout)
      discovery?.stop()

      try {
        signalingClient = new SignalingClient()
        await signalingClient.connect(
          host,
          port,
          (msg: SignalingMessage) => {
            mainWindow?.webContents.send('signaling-message', msg)
          },
          () => {
            mainWindow?.webContents.send('peer-connected', {
              hostname: announce.hostname,
              platform: announce.platform,
            })
          },
          () => {
            mainWindow?.webContents.send('peer-disconnected')
          }
        )
        resolve({ success: true })
      } catch (err: any) {
        resolve({ success: false, error: err.message })
      }
    })
  })
})

ipcMain.handle('end-session', async () => {
  discovery?.stop()
  signalingServer?.stop()
  signalingClient?.disconnect()
  inputController?.disable()
  discovery = null
  signalingServer = null
  signalingClient = null
})

ipcMain.on('signaling-message', (_event, msg: SignalingMessage) => {
  signalingServer?.send(msg)
  signalingClient?.send(msg)
})

ipcMain.on('simulate-input', (_event, inputEvent) => {
  inputController?.simulateInput(inputEvent)
})

ipcMain.on('enable-input', () => {
  inputController?.enable()
})

ipcMain.on('disable-input', () => {
  inputController?.disable()
})

ipcMain.handle('get-screen-source-id', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 0, height: 0 },
  })
  return sources[0]?.id ?? null
})

ipcMain.on('resize-window', (_event, width: number, height: number) => {
  if (!mainWindow) return
  const [currentWidth, currentHeight] = mainWindow.getSize()
  if (currentWidth !== width || currentHeight !== height) {
    mainWindow.setSize(width, height, true)
    mainWindow.center()
  }
})

ipcMain.on('window-minimize', () => mainWindow?.minimize())
ipcMain.on('window-close', () => mainWindow?.close())

ipcMain.handle('get-platform', () => process.platform)

ipcMain.handle('get-display-info', () => {
  const display = screen.getPrimaryDisplay()
  return {
    width: display.size.width,
    height: display.size.height,
    scaleFactor: display.scaleFactor,
  }
})

// ── App lifecycle ──────────────────────────────────────────────────

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  discovery?.stop()
  signalingServer?.stop()
  signalingClient?.disconnect()
  app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
