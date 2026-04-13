export interface DiscoveryAnnounce {
  type: 'quickswap-announce'
  code: string
  port: number
  hostname: string
  platform: string
}

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'control' | string
  data: any
}

export interface ControlMessage {
  type: 'swap-request' | 'swap-accept' | 'swap-deny' | 'control-release' | 'input-event'
  payload?: any
}

export interface InputEventData {
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

export function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}
