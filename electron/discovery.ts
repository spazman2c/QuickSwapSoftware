import dgram from 'dgram'
import os from 'os'
import { DiscoveryAnnounce } from './protocol'

const DISCOVERY_PORT = 41234
const BROADCAST_INTERVAL = 1000

export class Discovery {
  private socket: dgram.Socket | null = null
  private broadcastTimer: ReturnType<typeof setInterval> | null = null
  private onDiscovered: ((announce: DiscoveryAnnounce, address: string) => void) | null = null

  async startBroadcasting(code: string, signalingPort: number): Promise<void> {
    this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })

    await new Promise<void>((resolve, reject) => {
      this.socket!.bind(0, () => {
        this.socket!.setBroadcast(true)
        resolve()
      })
      this.socket!.on('error', reject)
    })

    const announce: DiscoveryAnnounce = {
      type: 'quickswap-announce',
      code,
      port: signalingPort,
      hostname: os.hostname(),
      platform: process.platform,
    }

    const message = Buffer.from(JSON.stringify(announce))
    const broadcastAddresses = this.getBroadcastAddresses()

    this.broadcastTimer = setInterval(() => {
      for (const addr of broadcastAddresses) {
        this.socket?.send(message, 0, message.length, DISCOVERY_PORT, addr)
      }
    }, BROADCAST_INTERVAL)
  }

  async startListening(
    targetCode: string,
    onFound: (host: string, port: number, announce: DiscoveryAnnounce) => void
  ): Promise<void> {
    this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })

    this.socket.on('message', (msg, rinfo) => {
      try {
        const announce: DiscoveryAnnounce = JSON.parse(msg.toString())
        if (announce.type === 'quickswap-announce' && announce.code === targetCode) {
          onFound(rinfo.address, announce.port, announce)
        }
      } catch {
        // Ignore malformed messages
      }
    })

    await new Promise<void>((resolve, reject) => {
      this.socket!.bind(DISCOVERY_PORT, () => {
        resolve()
      })
      this.socket!.on('error', reject)
    })
  }

  stop(): void {
    if (this.broadcastTimer) {
      clearInterval(this.broadcastTimer)
      this.broadcastTimer = null
    }
    if (this.socket) {
      try {
        this.socket.close()
      } catch {}
      this.socket = null
    }
  }

  private getBroadcastAddresses(): string[] {
    const addresses: string[] = ['255.255.255.255']
    const interfaces = os.networkInterfaces()

    for (const iface of Object.values(interfaces)) {
      if (!iface) continue
      for (const addr of iface) {
        if (addr.family === 'IPv4' && !addr.internal && addr.netmask) {
          const ip = addr.address.split('.').map(Number)
          const mask = addr.netmask.split('.').map(Number)
          const broadcast = ip.map((octet, i) => (octet | (~mask[i] & 255))).join('.')
          if (!addresses.includes(broadcast)) {
            addresses.push(broadcast)
          }
        }
      }
    }

    return addresses
  }
}
