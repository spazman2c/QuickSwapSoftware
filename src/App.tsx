import { useState, useEffect, useCallback, useRef } from 'react'
import { ViewState, SessionRole } from './types'
import HomeScreen from './components/HomeScreen'
import HostView from './components/HostView'
import JoinView from './components/JoinView'
import SessionView from './components/SessionView'
import TitleBar from './components/TitleBar'

export default function App() {
  const [view, setView] = useState<ViewState>('home')
  const [sessionCode, setSessionCode] = useState('')
  const [role, setRole] = useState<SessionRole>('host')
  const [peerName, setPeerName] = useState('')
  const [peerConnected, setPeerConnected] = useState(false)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteStreamRef = useRef<MediaStream | null>(null)
  const dataChannelRef = useRef<RTCDataChannel | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [isControlling, setIsControlling] = useState(false)

  useEffect(() => {
    window.quickswap.onPeerConnected((_event: any, data: any) => {
      setPeerName(data.hostname || 'Remote User')
      setPeerConnected(true)

      if (role === 'host') {
        startScreenShare()
      }
    })

    window.quickswap.onPeerDisconnected(() => {
      handleDisconnect()
    })

    window.quickswap.onSignalingMessage((_event: any, msg: any) => {
      handleSignalingMessage(msg)
    })

    return () => {
      window.quickswap.removeAllListeners('peer-connected')
      window.quickswap.removeAllListeners('peer-disconnected')
      window.quickswap.removeAllListeners('signaling-message')
    }
  }, [role])

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({
      iceServers: [],
    })

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        window.quickswap.sendSignalingMessage({
          type: 'ice-candidate',
          data: event.candidate.toJSON(),
        })
      }
    }

    pc.ontrack = (event) => {
      const stream = event.streams[0]
      remoteStreamRef.current = stream
      setRemoteStream(stream)
      setView('session')
      window.quickswap.resizeWindow(1024, 720)
    }

    pc.ondatachannel = (event) => {
      setupDataChannel(event.channel)
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        handleDisconnect()
      }
    }

    pcRef.current = pc
    return pc
  }, [])

  const setupDataChannel = useCallback((channel: RTCDataChannel) => {
    dataChannelRef.current = channel
    channel.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'input-event') {
          window.quickswap.simulateInput(msg.payload)
        } else if (msg.type === 'swap-request') {
          handleSwapRequest()
        } else if (msg.type === 'swap-accept') {
          handleSwapAccepted()
        } else if (msg.type === 'control-request') {
          window.quickswap.enableInput()
          setIsControlling(false)
          dataChannelRef.current?.send(JSON.stringify({ type: 'control-grant' }))
        } else if (msg.type === 'control-grant') {
          setIsControlling(true)
        }
      } catch {}
    }
  }, [])

  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 60, max: 60 },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })

      localStreamRef.current = stream

      const pc = createPeerConnection()

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream)
      })

      // Create data channel for control messages
      const dc = pc.createDataChannel('control', {
        ordered: true,
      })
      setupDataChannel(dc)

      // Configure encoding for high framerate/bitrate on LAN
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
      if (sender) {
        const params = sender.getParameters()
        if (!params.encodings || params.encodings.length === 0) {
          params.encodings = [{}]
        }
        params.encodings[0].maxFramerate = 60
        params.encodings[0].maxBitrate = 50_000_000
        await sender.setParameters(params)
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      window.quickswap.sendSignalingMessage({
        type: 'offer',
        data: offer,
      })
    } catch (err) {
      console.error('Failed to start screen share:', err)
    }
  }, [createPeerConnection, setupDataChannel])

  const handleSignalingMessage = useCallback(
    async (msg: any) => {
      if (msg.type === 'offer') {
        const pc = createPeerConnection()

        await pc.setRemoteDescription(new RTCSessionDescription(msg.data))

        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        window.quickswap.sendSignalingMessage({
          type: 'answer',
          data: answer,
        })
      } else if (msg.type === 'answer') {
        await pcRef.current?.setRemoteDescription(
          new RTCSessionDescription(msg.data)
        )
      } else if (msg.type === 'ice-candidate') {
        await pcRef.current?.addIceCandidate(
          new RTCIceCandidate(msg.data)
        )
      }
    },
    [createPeerConnection]
  )

  const handleSwapRequest = useCallback(async () => {
    // Auto-accept swap for now
    dataChannelRef.current?.send(JSON.stringify({ type: 'swap-accept' }))

    // Stop current sharing if we are
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    localStreamRef.current = null

    // Now we become the viewer — wait for the other side to send a new offer
  }, [])

  const handleSwapAccepted = useCallback(async () => {
    // Stop viewing, start sharing
    remoteStreamRef.current = null
    setRemoteStream(null)

    // Close old PC and create new one
    pcRef.current?.close()
    pcRef.current = null

    await startScreenShare()
  }, [startScreenShare])

  const requestSwap = useCallback(() => {
    dataChannelRef.current?.send(JSON.stringify({ type: 'swap-request' }))
  }, [])

  const requestControl = useCallback(() => {
    dataChannelRef.current?.send(JSON.stringify({ type: 'control-request' }))
  }, [])

  const handleDisconnect = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    remoteStreamRef.current = null
    pcRef.current?.close()
    dataChannelRef.current = null
    localStreamRef.current = null
    pcRef.current = null
    setRemoteStream(null)
    setPeerConnected(false)
    setIsControlling(false)
    window.quickswap.endSession()
    window.quickswap.disableInput()
    window.quickswap.resizeWindow(420, 580)
    setView('home')
  }, [])

  const handleHost = useCallback(async () => {
    setRole('host')
    const result = await window.quickswap.hostSession()
    setSessionCode(result.code)
    setView('host')
  }, [])

  const handleJoin = useCallback(() => {
    setRole('client')
    setView('join')
  }, [])

  const handleJoinSubmit = useCallback(async (code: string) => {
    setSessionCode(code)
    const result = await window.quickswap.joinSession(code)
    if (!result.success) {
      setView('join')
    }
  }, [])

  const handleCancel = useCallback(() => {
    window.quickswap.endSession()
    window.quickswap.resizeWindow(420, 580)
    setView('home')
  }, [])

  const sendInputEvent = useCallback((event: any) => {
    if (dataChannelRef.current?.readyState === 'open' && isControlling) {
      dataChannelRef.current.send(
        JSON.stringify({ type: 'input-event', payload: event })
      )
    }
  }, [isControlling])

  return (
    <div className="h-full flex flex-col">
      {view !== 'session' && <TitleBar />}

      <div className="flex-1 flex flex-col">
        {view === 'home' && (
          <HomeScreen onHost={handleHost} onJoin={handleJoin} />
        )}
        {view === 'host' && (
          <HostView
            code={sessionCode}
            peerConnected={peerConnected}
            onCancel={handleCancel}
          />
        )}
        {view === 'join' && (
          <JoinView onSubmit={handleJoinSubmit} onCancel={handleCancel} />
        )}
        {view === 'session' && remoteStream && (
          <SessionView
            stream={remoteStream}
            role={role}
            peerName={peerName}
            isControlling={isControlling}
            onDisconnect={handleDisconnect}
            onSwap={requestSwap}
            onRequestControl={requestControl}
            onInputEvent={sendInputEvent}
          />
        )}
      </div>
    </div>
  )
}
