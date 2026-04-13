import { screen } from 'electron'
import { spawn, ChildProcess } from 'node:child_process'
import { InputEventData } from './protocol'

export class InputController {
  private enabled = false
  private platform = process.platform
  private subprocess: ChildProcess | null = null
  private ready = false
  private queue: string[] = []

  enable(): void {
    this.enabled = true
    this.spawnIfNeeded()
  }

  disable(): void {
    this.enabled = false
  }

  destroy(): void {
    this.enabled = false
    this.queue = []
    if (this.subprocess) {
      try { this.subprocess.stdin?.end() } catch {}
      try { this.subprocess.kill() } catch {}
      this.subprocess = null
      this.ready = false
    }
  }

  simulateInput(event: InputEventData): void {
    if (!this.enabled) return

    const display = screen.getPrimaryDisplay()
    const { width, height } = display.size

    try {
      if (this.platform === 'darwin') {
        this.sendMacCommand(event, width, height)
      } else if (this.platform === 'win32') {
        this.sendWindowsCommand(event, width, height)
      }
    } catch {
      // Silently ignore to not break the stream
    }
  }

  private spawnIfNeeded(): void {
    // Already running or starting — don't respawn
    if (this.subprocess) return

    if (this.platform === 'darwin') {
      this.spawnMacHelper()
    } else if (this.platform === 'win32') {
      this.spawnWindowsHelper()
    }
  }

  private flushQueue(): void {
    if (!this.subprocess?.stdin?.writable) return
    for (const line of this.queue) {
      this.subprocess.stdin.write(line)
    }
    this.queue = []
  }

  private send(json: Record<string, any>): void {
    const line = JSON.stringify(json) + '\n'

    if (this.ready && this.subprocess?.stdin?.writable) {
      this.subprocess.stdin.write(line)
    } else {
      // Buffer until ready (only keep last ~20 to avoid flooding)
      if (this.queue.length > 20) this.queue.shift()
      this.queue.push(line)
      this.spawnIfNeeded()
    }
  }

  // ── macOS: persistent Python + Quartz ────────────────────────

  private spawnMacHelper(): void {
    const script = `
import sys, json, Quartz

def handle(cmd):
    t = cmd['type']
    if t == 'mouse-move':
        e = Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventMouseMoved, (cmd['x'], cmd['y']), Quartz.kCGMouseButtonLeft)
        Quartz.CGEventPost(Quartz.kCGHIDEventTap, e)
    elif t == 'mouse-down':
        right = cmd.get('button') == 'right'
        et = Quartz.kCGEventRightMouseDown if right else Quartz.kCGEventLeftMouseDown
        btn = Quartz.kCGMouseButtonRight if right else Quartz.kCGMouseButtonLeft
        e = Quartz.CGEventCreateMouseEvent(None, et, (cmd['x'], cmd['y']), btn)
        Quartz.CGEventPost(Quartz.kCGHIDEventTap, e)
    elif t == 'mouse-up':
        right = cmd.get('button') == 'right'
        et = Quartz.kCGEventRightMouseUp if right else Quartz.kCGEventLeftMouseUp
        btn = Quartz.kCGMouseButtonRight if right else Quartz.kCGMouseButtonLeft
        e = Quartz.CGEventCreateMouseEvent(None, et, (cmd['x'], cmd['y']), btn)
        Quartz.CGEventPost(Quartz.kCGHIDEventTap, e)
    elif t == 'mouse-scroll':
        dy = cmd.get('deltaY', 0)
        dx = cmd.get('deltaX', 0)
        e = Quartz.CGEventCreateScrollWheelEvent(None, Quartz.kCGScrollEventUnitPixel, 2, dy, dx)
        Quartz.CGEventPost(Quartz.kCGHIDEventTap, e)
    elif t in ('key-down', 'key-up'):
        down = t == 'key-down'
        kc = cmd.get('keyCode', -1)
        if kc >= 0:
            e = Quartz.CGEventCreateKeyboardEvent(None, kc, down)
            flags = cmd.get('flags', 0)
            if flags:
                e.setFlags(flags)
            Quartz.CGEventPost(Quartz.kCGHIDEventTap, e)

sys.stdout.write('ready\\n')
sys.stdout.flush()
for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        cmd = json.loads(line)
        handle(cmd)
    except Exception:
        pass
`

    // Use /usr/bin/python3 to guarantee Apple's system Python with PyObjC Quartz
    const pythonPath = '/usr/bin/python3'

    this.subprocess = spawn(pythonPath, ['-u', '-c', script], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    this.subprocess.stdout?.once('data', () => {
      this.ready = true
      this.flushQueue()
    })

    this.subprocess.stderr?.on('data', (data: Buffer) => {
      console.error('[input-controller] python stderr:', data.toString().trim())
    })

    this.subprocess.on('error', (err: Error) => {
      console.error('[input-controller] spawn error:', err.message)
      this.subprocess = null
      this.ready = false
    })

    this.subprocess.on('exit', (code: number | null) => {
      console.log('[input-controller] python exited with code', code)
      this.subprocess = null
      this.ready = false
      // Respawn after a delay if still enabled
      if (this.enabled) {
        setTimeout(() => this.spawnIfNeeded(), 500)
      }
    })
  }

  private sendMacCommand(event: InputEventData, width: number, height: number): void {
    let cmd: Record<string, any> | null = null

    switch (event.type) {
      case 'mouse-move': {
        if (event.x != null && event.y != null) {
          cmd = { type: 'mouse-move', x: Math.round(event.x * width), y: Math.round(event.y * height) }
        }
        break
      }
      case 'mouse-down': {
        if (event.x != null && event.y != null) {
          cmd = { type: 'mouse-down', x: Math.round(event.x * width), y: Math.round(event.y * height), button: event.button || 'left' }
        }
        break
      }
      case 'mouse-up': {
        if (event.x != null && event.y != null) {
          cmd = { type: 'mouse-up', x: Math.round(event.x * width), y: Math.round(event.y * height), button: event.button || 'left' }
        }
        break
      }
      case 'mouse-scroll': {
        if (event.deltaY != null) {
          cmd = { type: 'mouse-scroll', deltaY: Math.round(-event.deltaY / 3), deltaX: event.deltaX != null ? Math.round(-event.deltaX / 3) : 0 }
        }
        break
      }
      case 'key-down':
      case 'key-up': {
        if (event.code) {
          const keyCode = this.macKeyCode(event.code)
          if (keyCode !== -1) {
            cmd = { type: event.type, keyCode, flags: this.macModifierFlagValue(event.modifiers) }
          }
        }
        break
      }
    }

    if (cmd) this.send(cmd)
  }

  // ── Windows: persistent PowerShell ───────────────────────────

  private spawnWindowsHelper(): void {
    const script = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class NativeInput {
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
    [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, int dx, int dy, int dwData, IntPtr dwExtraInfo);
    [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, IntPtr dwExtraInfo);
}
"@
Add-Type -AssemblyName System.Web.Extensions
$ser = New-Object System.Web.Script.Serialization.JavaScriptSerializer
Write-Host "ready"
while ($true) {
    $line = [Console]::In.ReadLine()
    if ($line -eq $null) { break }
    if ($line.Trim() -eq "") { continue }
    try {
        $cmd = $ser.DeserializeObject($line)
        $t = $cmd["type"]
        if ($t -eq "mouse-move") {
            [NativeInput]::SetCursorPos([int]$cmd["x"], [int]$cmd["y"])
        } elseif ($t -eq "mouse-down") {
            [NativeInput]::SetCursorPos([int]$cmd["x"], [int]$cmd["y"])
            $flag = if ($cmd["button"] -eq "right") { 0x0008 } else { 0x0002 }
            [NativeInput]::mouse_event($flag, 0, 0, 0, [IntPtr]::Zero)
        } elseif ($t -eq "mouse-up") {
            $flag = if ($cmd["button"] -eq "right") { 0x0010 } else { 0x0004 }
            [NativeInput]::mouse_event($flag, 0, 0, 0, [IntPtr]::Zero)
        } elseif ($t -eq "mouse-scroll") {
            [NativeInput]::mouse_event(0x0800, 0, 0, [int]$cmd["deltaY"], [IntPtr]::Zero)
        } elseif ($t -eq "key-down") {
            [NativeInput]::keybd_event([byte]$cmd["vk"], 0, 0x0000, [IntPtr]::Zero)
        } elseif ($t -eq "key-up") {
            [NativeInput]::keybd_event([byte]$cmd["vk"], 0, 0x0002, [IntPtr]::Zero)
        }
    } catch {}
}
`

    this.subprocess = spawn('powershell', ['-NoProfile', '-NoLogo', '-Command', '-'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    this.subprocess.stdout?.once('data', () => {
      this.ready = true
      this.flushQueue()
    })

    this.subprocess.stdin?.write(script + '\n')

    this.subprocess.on('error', (err: Error) => {
      console.error('[input-controller] powershell error:', err.message)
      this.subprocess = null
      this.ready = false
    })

    this.subprocess.on('exit', () => {
      this.subprocess = null
      this.ready = false
      if (this.enabled) {
        setTimeout(() => this.spawnIfNeeded(), 500)
      }
    })
  }

  private sendWindowsCommand(event: InputEventData, width: number, height: number): void {
    let cmd: Record<string, any> | null = null

    switch (event.type) {
      case 'mouse-move': {
        if (event.x != null && event.y != null) {
          cmd = { type: 'mouse-move', x: Math.round(event.x * width), y: Math.round(event.y * height) }
        }
        break
      }
      case 'mouse-down': {
        if (event.x != null && event.y != null) {
          cmd = { type: 'mouse-down', x: Math.round(event.x * width), y: Math.round(event.y * height), button: event.button || 'left' }
        }
        break
      }
      case 'mouse-up': {
        if (event.x != null && event.y != null) {
          cmd = { type: 'mouse-up', x: Math.round(event.x * width), y: Math.round(event.y * height), button: event.button || 'left' }
        }
        break
      }
      case 'mouse-scroll': {
        if (event.deltaY != null) {
          cmd = { type: 'mouse-scroll', deltaY: Math.round(-event.deltaY) }
        }
        break
      }
      case 'key-down':
      case 'key-up': {
        if (event.code) {
          const vk = this.windowsVK(event.code)
          if (vk) {
            cmd = { type: event.type, vk: parseInt(vk, 16) }
          }
        }
        break
      }
    }

    if (cmd) this.send(cmd)
  }

  // ── Key code mappings ────────────────────────────────────────

  private macModifierFlagValue(mods?: InputEventData['modifiers']): number {
    if (!mods) return 0
    let flags = 0
    if (mods.shift) flags |= 0x20000   // kCGEventFlagMaskShift
    if (mods.ctrl) flags |= 0x40000    // kCGEventFlagMaskControl
    if (mods.alt) flags |= 0x80000     // kCGEventFlagMaskAlternate
    if (mods.meta) flags |= 0x100000   // kCGEventFlagMaskCommand
    return flags
  }

  private macKeyCode(code: string): number {
    const map: Record<string, number> = {
      KeyA: 0, KeyS: 1, KeyD: 2, KeyF: 3, KeyH: 4, KeyG: 5, KeyZ: 6, KeyX: 7,
      KeyC: 8, KeyV: 9, KeyB: 11, KeyQ: 12, KeyW: 13, KeyE: 14, KeyR: 15,
      KeyY: 16, KeyT: 17, KeyO: 31, KeyU: 32, KeyI: 34, KeyP: 35, KeyL: 37,
      KeyJ: 38, KeyK: 40, KeyN: 45, KeyM: 46,
      Digit1: 18, Digit2: 19, Digit3: 20, Digit4: 21, Digit5: 23,
      Digit6: 22, Digit7: 26, Digit8: 28, Digit9: 25, Digit0: 29,
      Enter: 36, Escape: 53, Backspace: 51, Tab: 48, Space: 49,
      Minus: 27, Equal: 24, BracketLeft: 33, BracketRight: 30,
      Backslash: 42, Semicolon: 41, Quote: 39, Backquote: 50,
      Comma: 43, Period: 47, Slash: 44,
      ArrowUp: 126, ArrowDown: 125, ArrowLeft: 123, ArrowRight: 124,
      Delete: 117, Home: 115, End: 119, PageUp: 116, PageDown: 121,
      F1: 122, F2: 120, F3: 99, F4: 118, F5: 96, F6: 97,
      F7: 98, F8: 100, F9: 101, F10: 109, F11: 103, F12: 111,
      ShiftLeft: 56, ShiftRight: 60, ControlLeft: 59, ControlRight: 62,
      AltLeft: 58, AltRight: 61, MetaLeft: 55, MetaRight: 54,
      CapsLock: 57,
    }
    return map[code] ?? -1
  }

  private windowsVK(code: string): string | null {
    const map: Record<string, string> = {
      KeyA: '0x41', KeyB: '0x42', KeyC: '0x43', KeyD: '0x44', KeyE: '0x45',
      KeyF: '0x46', KeyG: '0x47', KeyH: '0x48', KeyI: '0x49', KeyJ: '0x4A',
      KeyK: '0x4B', KeyL: '0x4C', KeyM: '0x4D', KeyN: '0x4E', KeyO: '0x4F',
      KeyP: '0x50', KeyQ: '0x51', KeyR: '0x52', KeyS: '0x53', KeyT: '0x54',
      KeyU: '0x55', KeyV: '0x56', KeyW: '0x57', KeyX: '0x58', KeyY: '0x59',
      KeyZ: '0x5A',
      Digit0: '0x30', Digit1: '0x31', Digit2: '0x32', Digit3: '0x33',
      Digit4: '0x34', Digit5: '0x35', Digit6: '0x36', Digit7: '0x37',
      Digit8: '0x38', Digit9: '0x39',
      Enter: '0x0D', Escape: '0x1B', Backspace: '0x08', Tab: '0x09',
      Space: '0x20', Minus: '0xBD', Equal: '0xBB',
      BracketLeft: '0xDB', BracketRight: '0xDD', Backslash: '0xDC',
      Semicolon: '0xBA', Quote: '0xDE', Backquote: '0xC0',
      Comma: '0xBC', Period: '0xBE', Slash: '0xBF',
      ArrowUp: '0x26', ArrowDown: '0x28', ArrowLeft: '0x25', ArrowRight: '0x27',
      Delete: '0x2E', Home: '0x24', End: '0x23', PageUp: '0x21', PageDown: '0x22',
      F1: '0x70', F2: '0x71', F3: '0x72', F4: '0x73', F5: '0x74', F6: '0x75',
      F7: '0x76', F8: '0x77', F9: '0x78', F10: '0x79', F11: '0x7A', F12: '0x7B',
      ShiftLeft: '0x10', ShiftRight: '0x10', ControlLeft: '0x11', ControlRight: '0x11',
      AltLeft: '0x12', AltRight: '0x12', MetaLeft: '0x5B', MetaRight: '0x5C',
      CapsLock: '0x14',
    }
    return map[code] ?? null
  }

  get isAvailable(): boolean {
    return true
  }
}
