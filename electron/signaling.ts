import { WebSocketServer, WebSocket } from 'ws'
import { SignalingMessage } from './protocol'
import { AddressInfo } from 'net'

export class SignalingServer {
  private wss: WebSocketServer | null = null
  private client: WebSocket | null = null
  private onMessage: ((msg: SignalingMessage) => void) | null = null
  private onClientConnected: (() => void) | null = null
  private onClientDisconnected: (() => void) | null = null
  port: number = 0

  async start(
    onMessage: (msg: SignalingMessage) => void,
    onClientConnected: () => void,
    onClientDisconnected: () => void
  ): Promise<number> {
    this.onMessage = onMessage
    this.onClientConnected = onClientConnected
    this.onClientDisconnected = onClientDisconnected

    return new Promise((resolve, reject) => {
      this.wss = new WebSocketServer({ port: 0 }, () => {
        this.port = (this.wss!.address() as AddressInfo).port
        resolve(this.port)
      })

      this.wss.on('error', reject)

      this.wss.on('connection', (ws) => {
        if (this.client) {
          ws.close(1008, 'Only one client allowed')
          return
        }

        this.client = ws
        this.onClientConnected?.()

        ws.on('message', (data) => {
          try {
            const msg: SignalingMessage = JSON.parse(data.toString())
            this.onMessage?.(msg)
          } catch {}
        })

        ws.on('close', () => {
          this.client = null
          this.onClientDisconnected?.()
        })

        ws.on('error', () => {
          this.client = null
          this.onClientDisconnected?.()
        })
      })
    })
  }

  send(msg: SignalingMessage): void {
    if (this.client?.readyState === WebSocket.OPEN) {
      this.client.send(JSON.stringify(msg))
    }
  }

  stop(): void {
    this.client?.close()
    this.client = null
    this.wss?.close()
    this.wss = null
  }
}

export class SignalingClient {
  private ws: WebSocket | null = null
  private onMessage: ((msg: SignalingMessage) => void) | null = null
  private onDisconnected: (() => void) | null = null

  async connect(
    host: string,
    port: number,
    onMessage: (msg: SignalingMessage) => void,
    onConnected: () => void,
    onDisconnected: () => void
  ): Promise<void> {
    this.onMessage = onMessage
    this.onDisconnected = onDisconnected

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`ws://${host}:${port}`)

      this.ws.on('open', () => {
        onConnected()
        resolve()
      })

      this.ws.on('message', (data) => {
        try {
          const msg: SignalingMessage = JSON.parse(data.toString())
          this.onMessage?.(msg)
        } catch {}
      })

      this.ws.on('close', () => {
        this.onDisconnected?.()
      })

      this.ws.on('error', (err) => {
        reject(err)
      })
    })
  }

  send(msg: SignalingMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }

  disconnect(): void {
    this.ws?.close()
    this.ws = null
  }
}
