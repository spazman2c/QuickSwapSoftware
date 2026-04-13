import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('quickswap', {
  hostSession: () => ipcRenderer.invoke('host-session'),
  joinSession: (code: string) => ipcRenderer.invoke('join-session', code),
  endSession: () => ipcRenderer.invoke('end-session'),
  simulateInput: (event: any) => ipcRenderer.send('simulate-input', event),
  sendSignalingMessage: (msg: any) => ipcRenderer.send('signaling-message', msg),
  getScreenSourceId: () => ipcRenderer.invoke('get-screen-source-id'),
  getDisplayInfo: () => ipcRenderer.invoke('get-display-info'),
  enableInput: () => ipcRenderer.send('enable-input'),
  disableInput: () => ipcRenderer.send('disable-input'),
  resizeWindow: (width: number, height: number) =>
    ipcRenderer.send('resize-window', width, height),
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),

  onPeerConnected: (callback: (event: any, data: any) => void) =>
    ipcRenderer.on('peer-connected', callback),
  onPeerDisconnected: (callback: () => void) =>
    ipcRenderer.on('peer-disconnected', (_event) => callback()),
  onSignalingMessage: (callback: (event: any, msg: any) => void) =>
    ipcRenderer.on('signaling-message', callback),
  onControlRequest: (callback: () => void) =>
    ipcRenderer.on('control-request', (_event) => callback()),
  removeAllListeners: (channel: string) =>
    ipcRenderer.removeAllListeners(channel),
})
