import { useState, useEffect, useCallback, useRef } from 'react'
import { ViewState, SessionRole } from './types'
import HomeScreen from './components/HomeScreen'
import HostView from './components/HostView'
import JoinView from './components/JoinView'
import SessionView from './components/SessionView'
import TitleBar from './components/TitleBar'
import NetworkTest from './components/NetworkTest'

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
  const [gameMode, setGameMode] = useState(false)
  const swappingRef = useRef(false)

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
    // Clean up old connection if it exists
    if (pcRef.current) {
      pcRef.current.onicecandidate = null
      pcRef.current.ontrack = null
      pcRef.current.ondatachannel = null
      pcRef.current.onconnectionstatechange = null
      pcRef.current.close()
      pcRef.current = null
    }

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
        if (!swappingRef.current) {
          handleDisconnect()
        }
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
        } else if (msg.type === 'control-request') {
          window.quickswap.enableInput()
          setIsControlling(false)
          dataChannelRef.current?.send(JSON.stringify({ type: 'control-grant' }))
        } else if (msg.type === 'control-grant') {
          setIsControlling(true)
        } else if (msg.type === 'game-mode') {
          setGameMode(msg.enabled)
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

      // Hint the track for fluid motion so the encoder prioritizes framerate
      const videoTrack = stream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.contentHint = 'motion'
      }

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

      // Prefer H.264 for hardware-accelerated encoding (much better FPS)
      const transceivers = pc.getTransceivers()
      const videoTransceiver = transceivers.find(
        (t) => t.sender.track?.kind === 'video'
      )
      if (videoTransceiver) {
        const codecs = RTCRtpReceiver.getCapabilities('video')?.codecs || []
        const h264Codecs = codecs.filter(
          (c) => c.mimeType === 'video/H264'
        )
        const otherCodecs = codecs.filter(
          (c) => c.mimeType !== 'video/H264'
        )
        if (h264Codecs.length > 0) {
          videoTransceiver.setCodecPreferences([...h264Codecs, ...otherCodecs])
        }
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      // Set encoding params after creating the offer so they stick
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
      if (sender) {
        const params = sender.getParameters()
        if (!params.encodings || params.encodings.length === 0) {
          params.encodings = [{}]
        }
        params.encodings[0].maxFramerate = 60
        params.encodings[0].maxBitrate = 50_000_000
        params.encodings[0].networkPriority = 'high'
        params.encodings[0].priority = 'high'
        // Disable bandwidth probing delays — we're on LAN
        params.degradationPreference = 'maintain-framerate'
        await sender.setParameters(params)
      }

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
        // Close any existing connection cleanly before accepting new offer
        if (pcRef.current) {
          pcRef.current.onicecandidate = null
          pcRef.current.ontrack = null
          pcRef.current.ondatachannel = null
          pcRef.current.onconnectionstatechange = null
          pcRef.current.close()
          pcRef.current = null
        }

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
      } else if (msg.type === 'control' && msg.data?.action === 'swap-request') {
        handleSwapRequest()
      } else if (msg.type === 'control' && msg.data?.action === 'swap-accept') {
        handleSwapAccepted()
      }
    },
    [createPeerConnection]
  )

  const handleSwapRequest = useCallback(async () => {
    // Accept the swap — tell the other side via signaling (not data channel)
    window.quickswap.sendSignalingMessage({
      type: 'control',
      data: { action: 'swap-accept' },
    })

    swappingRef.current = true

    // Stop current sharing
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    localStreamRef.current = null
    remoteStreamRef.current = null
    setRemoteStream(null)
    dataChannelRef.current = null
    setIsControlling(false)
    window.quickswap.disableInput()

    // Close old PC — the other side will create a new one and send an offer
    if (pcRef.current) {
      pcRef.current.onconnectionstatechange = null
      pcRef.current.close()
      pcRef.current = null
    }

    swappingRef.current = false
    // Now wait for the new offer to arrive via signaling
  }, [])

  const handleSwapAccepted = useCallback(async () => {
    swappingRef.current = true

    // Stop viewing
    remoteStreamRef.current = null
    setRemoteStream(null)
    dataChannelRef.current = null
    setIsControlling(false)
    window.quickswap.disableInput()

    // Close old PC cleanly
    if (pcRef.current) {
      pcRef.current.onconnectionstatechange = null
      pcRef.current.close()
      pcRef.current = null
    }

    swappingRef.current = false

    // Now start sharing our screen — creates new PC + offer
    await startScreenShare()
  }, [startScreenShare])

  const requestSwap = useCallback(() => {
    // Send swap request via signaling server (survives PC teardown)
    window.quickswap.sendSignalingMessage({
      type: 'control',
      data: { action: 'swap-request' },
    })
  }, [])

  const requestControl = useCallback(() => {
    dataChannelRef.current?.send(JSON.stringify({ type: 'control-request' }))
  }, [])

  const toggleGameMode = useCallback(async () => {
    const newGameMode = !gameMode
    setGameMode(newGameMode)

    // Adjust encoding parameters on the active sender
    const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === 'video')
    if (sender) {
      try {
        const params = sender.getParameters()
        if (params.encodings && params.encodings.length > 0) {
          if (newGameMode) {
            // Game mode: lower resolution (scale down by 1.5x), max bitrate, prioritize framerate
            params.encodings[0].maxFramerate = 60
            params.encodings[0].maxBitrate = 30_000_000
            params.encodings[0].scaleResolutionDownBy = 1.5
          } else {
            // Normal mode: full resolution, high bitrate
            params.encodings[0].maxFramerate = 60
            params.encodings[0].maxBitrate = 50_000_000
            params.encodings[0].scaleResolutionDownBy = 1.0
          }
          params.degradationPreference = 'maintain-framerate'
          await sender.setParameters(params)
        }
      } catch {
        // Sender may not be ready
      }
    }

    // Also notify the peer about game mode via data channel
    if (dataChannelRef.current?.readyState === 'open') {
      dataChannelRef.current.send(
        JSON.stringify({ type: 'game-mode', enabled: newGameMode })
      )
    }
  }, [gameMode])

  const handleDisconnect = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    remoteStreamRef.current = null
    if (pcRef.current) {
      pcRef.current.onconnectionstatechange = null
      pcRef.current.close()
    }
    dataChannelRef.current = null
    localStreamRef.current = null
    pcRef.current = null
    setRemoteStream(null)
    setPeerConnected(false)
    setIsControlling(false)
    setGameMode(false)
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
          <HomeScreen onHost={handleHost} onJoin={handleJoin} onNetworkTest={() => setView('network-test')} />
        )}
        {view === 'network-test' && (
          <NetworkTest onBack={() => setView('home')} />
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
            pc={pcRef.current}
            role={role}
            peerName={peerName}
            isControlling={isControlling}
            gameMode={gameMode}
            onDisconnect={handleDisconnect}
            onSwap={requestSwap}
            onRequestControl={requestControl}
            onToggleGameMode={toggleGameMode}
            onInputEvent={sendInputEvent}
          />
        )}
      </div>
    </div>
  )
}
