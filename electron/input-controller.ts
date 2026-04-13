import { screen } from 'electron'
import { execFile } from 'node:child_process'
import { InputEventData } from './protocol'

export class InputController {
  private enabled = false
  private platform = process.platform

  enable(): void {
    this.enabled = true
  }

  disable(): void {
    this.enabled = false
  }

  simulateInput(event: InputEventData): void {
    if (!this.enabled) return

    const display = screen.getPrimaryDisplay()
    const { width, height } = display.size
    const scale = display.scaleFactor

    try {
      if (this.platform === 'darwin') {
        this.simulateMac(event, width, height, scale)
      } else if (this.platform === 'win32') {
        this.simulateWindows(event, width, height)
      }
    } catch (err) {
      // Silently ignore simulation errors to not break the stream
    }
  }

  private simulateMac(event: InputEventData, width: number, height: number, _scale: number): void {
    switch (event.type) {
      case 'mouse-move': {
        if (event.x != null && event.y != null) {
          const x = Math.round(event.x * width)
          const y = Math.round(event.y * height)
          this.runAppleScript(`
            tell application "System Events"
              set position of mouse to {${x}, ${y}}
            end tell
          `)
          // Fallback: use CGEvent via python for mouse move (more reliable)
          this.runPython(`
import Quartz
e = Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventMouseMoved, (${x}, ${y}), Quartz.kCGMouseButtonLeft)
Quartz.CGEventPost(Quartz.kCGHIDEventTap, e)
`)
        }
        break
      }
      case 'mouse-down': {
        if (event.x != null && event.y != null) {
          const x = Math.round(event.x * width)
          const y = Math.round(event.y * height)
          const isRight = event.button === 'right'
          const eventType = isRight ? 'Quartz.kCGEventRightMouseDown' : 'Quartz.kCGEventLeftMouseDown'
          const button = isRight ? 'Quartz.kCGMouseButtonRight' : 'Quartz.kCGMouseButtonLeft'
          this.runPython(`
import Quartz
e = Quartz.CGEventCreateMouseEvent(None, ${eventType}, (${x}, ${y}), ${button})
Quartz.CGEventPost(Quartz.kCGHIDEventTap, e)
`)
        }
        break
      }
      case 'mouse-up': {
        if (event.x != null && event.y != null) {
          const x = Math.round(event.x * width)
          const y = Math.round(event.y * height)
          const isRight = event.button === 'right'
          const eventType = isRight ? 'Quartz.kCGEventRightMouseUp' : 'Quartz.kCGEventLeftMouseUp'
          const button = isRight ? 'Quartz.kCGMouseButtonRight' : 'Quartz.kCGMouseButtonLeft'
          this.runPython(`
import Quartz
e = Quartz.CGEventCreateMouseEvent(None, ${eventType}, (${x}, ${y}), ${button})
Quartz.CGEventPost(Quartz.kCGHIDEventTap, e)
`)
        }
        break
      }
      case 'mouse-scroll': {
        if (event.deltaY != null) {
          // CGEvent scroll: positive = up, negative = down (opposite of browser)
          const delta = Math.round(-event.deltaY / 3)
          const deltaX = event.deltaX != null ? Math.round(-event.deltaX / 3) : 0
          this.runPython(`
import Quartz
e = Quartz.CGEventCreateScrollWheelEvent(None, Quartz.kCGScrollEventUnitPixel, 2, ${delta}, ${deltaX})
Quartz.CGEventPost(Quartz.kCGHIDEventTap, e)
`)
        }
        break
      }
      case 'key-down':
      case 'key-up': {
        if (event.code) {
          const down = event.type === 'key-down'
          const keyCode = this.macKeyCode(event.code)
          if (keyCode !== -1) {
            const flags = this.macModifierFlags(event.modifiers)
            this.runPython(`
import Quartz
e = Quartz.CGEventCreateKeyboardEvent(None, ${keyCode}, ${down ? 'True' : 'False'})
${flags ? `e.setFlags(${flags})` : ''}
Quartz.CGEventPost(Quartz.kCGHIDEventTap, e)
`)
          }
        }
        break
      }
    }
  }

  private simulateWindows(event: InputEventData, width: number, height: number): void {
    switch (event.type) {
      case 'mouse-move': {
        if (event.x != null && event.y != null) {
          const x = Math.round(event.x * width)
          const y = Math.round(event.y * height)
          this.runPowerShell(`[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y})`)
        }
        break
      }
      case 'mouse-down': {
        if (event.x != null && event.y != null) {
          const x = Math.round(event.x * width)
          const y = Math.round(event.y * height)
          const flag = event.button === 'right' ? '0x0008' : '0x0002'
          this.runPowerShell(`
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class MouseInput {
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
    [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, int dx, int dy, int dwData, IntPtr dwExtraInfo);
}
"@
[MouseInput]::SetCursorPos(${x}, ${y})
[MouseInput]::mouse_event(${flag}, 0, 0, 0, [IntPtr]::Zero)
`)
        }
        break
      }
      case 'mouse-up': {
        const flag = event.button === 'right' ? '0x0010' : '0x0004'
        this.runPowerShell(`
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class MouseInput2 {
    [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, int dx, int dy, int dwData, IntPtr dwExtraInfo);
}
"@
[MouseInput2]::mouse_event(${flag}, 0, 0, 0, [IntPtr]::Zero)
`)
        break
      }
      case 'mouse-scroll': {
        if (event.deltaY != null) {
          const delta = Math.round(-event.deltaY)
          this.runPowerShell(`
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class ScrollInput {
    [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, int dx, int dy, int dwData, IntPtr dwExtraInfo);
}
"@
[ScrollInput]::mouse_event(0x0800, 0, 0, ${delta}, [IntPtr]::Zero)
`)
        }
        break
      }
      case 'key-down':
      case 'key-up': {
        if (event.code) {
          const vk = this.windowsVK(event.code)
          if (vk) {
            const flag = event.type === 'key-up' ? '0x0002' : '0x0000'
            this.runPowerShell(`
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class KeyInput {
    [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, IntPtr dwExtraInfo);
}
"@
[KeyInput]::keybd_event(${vk}, 0, ${flag}, [IntPtr]::Zero)
`)
          }
        }
        break
      }
    }
  }

  private runAppleScript(script: string): void {
    execFile('osascript', ['-e', script.trim()], { timeout: 500 }, () => {})
  }

  private runPython(script: string): void {
    execFile('python3', ['-c', script.trim()], { timeout: 500 }, () => {})
  }

  private runPowerShell(script: string): void {
    execFile('powershell', ['-NoProfile', '-Command', script.trim()], { timeout: 1000 }, () => {})
  }

  private macModifierFlags(mods?: InputEventData['modifiers']): string {
    if (!mods) return ''
    const flags: string[] = []
    if (mods.shift) flags.push('Quartz.kCGEventFlagMaskShift')
    if (mods.ctrl) flags.push('Quartz.kCGEventFlagMaskControl')
    if (mods.alt) flags.push('Quartz.kCGEventFlagMaskAlternate')
    if (mods.meta) flags.push('Quartz.kCGEventFlagMaskCommand')
    return flags.length > 0 ? flags.join(' | ') : ''
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
