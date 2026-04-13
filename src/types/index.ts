export type ViewState = 'home' | 'host' | 'join' | 'session' | 'network-test'

export type SessionRole = 'host' | 'client'

export type ControlState = 'idle' | 'controlling' | 'controlled'

export interface SessionInfo {
  code: string
  role: SessionRole
  peerName: string
  controlState: ControlState
  isSharing: boolean
}

export interface InputEvent {
  type: 'mouse-move' | 'mouse-down' | 'mouse-up' | 'mouse-scroll' | 'key-down' | 'key-up'
  x?: number
  y?: number
  button?: 'left' | 'right' | 'middle'
  deltaX?: number
  deltaY?: number
  key?: string
  code?: string
  modifiers?: {
    ctrl?: boolean
    alt?: boolean
    shift?: boolean
    meta?: boolean
  }
}

export interface SessionStats {
  fps: number
  latency: number
  resolution: string
  bitrate: number
}

export interface QuickSwapAPI {
  hostSession: () => Promise<{ code: string }>
  joinSession: (code: string) => Promise<{ success: boolean; error?: string }>
  endSession: () => Promise<void>
  simulateInput: (event: InputEvent) => void
  sendSignalingMessage: (msg: any) => void
  getScreenSourceId: () => Promise<string>
  resizeWindow: (width: number, height: number) => void
  minimizeWindow: () => void
  closeWindow: () => void
  onPeerConnected: (callback: (event: any, data: any) => void) => void
  onPeerDisconnected: (callback: () => void) => void
  onSignalingMessage: (callback: (event: any, msg: any) => void) => void
  onControlRequest: (callback: () => void) => void
  enableInput: () => void
  disableInput: () => void
  removeAllListeners: (channel: string) => void
  getPlatform: () => string
}

declare global {
  interface Window {
    quickswap: QuickSwapAPI
  }
}
