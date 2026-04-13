import { screen } from 'electron'
import { InputEventData } from './protocol'

let robot: any = null

try {
  robot = require('robotjs')
} catch {
  console.warn('robotjs not available — input simulation disabled')
}

export class InputController {
  private enabled = false

  enable(): void {
    this.enabled = true
  }

  disable(): void {
    this.enabled = false
  }

  simulateInput(event: InputEventData): void {
    if (!this.enabled || !robot) return

    const display = screen.getPrimaryDisplay()
    const { width, height } = display.size

    try {
      switch (event.type) {
        case 'mouse-move': {
          if (event.x != null && event.y != null) {
            const absX = Math.round(event.x * width)
            const absY = Math.round(event.y * height)
            robot.moveMouse(absX, absY)
          }
          break
        }
        case 'mouse-down': {
          const btn = event.button === 'right' ? 'right' : 'left'
          if (event.x != null && event.y != null) {
            robot.moveMouse(Math.round(event.x * width), Math.round(event.y * height))
          }
          robot.mouseToggle('down', btn)
          break
        }
        case 'mouse-up': {
          const btn = event.button === 'right' ? 'right' : 'left'
          robot.mouseToggle('up', btn)
          break
        }
        case 'mouse-scroll': {
          if (event.deltaY != null) {
            robot.scrollMouse(0, Math.round(event.deltaY))
          }
          break
        }
        case 'key-down': {
          if (event.key) {
            const modifiers = this.getModifiers(event.modifiers)
            robot.keyToggle(this.mapKey(event.key), 'down', modifiers)
          }
          break
        }
        case 'key-up': {
          if (event.key) {
            const modifiers = this.getModifiers(event.modifiers)
            robot.keyToggle(this.mapKey(event.key), 'up', modifiers)
          }
          break
        }
      }
    } catch (err) {
      // Silently ignore simulation errors to not break the stream
    }
  }

  private getModifiers(mods?: InputEventData['modifiers']): string[] {
    if (!mods) return []
    const result: string[] = []
    if (mods.ctrl) result.push('control')
    if (mods.alt) result.push('alt')
    if (mods.shift) result.push('shift')
    if (mods.meta) result.push('command')
    return result
  }

  private mapKey(key: string): string {
    const keyMap: Record<string, string> = {
      'Enter': 'enter',
      'Backspace': 'backspace',
      'Tab': 'tab',
      'Escape': 'escape',
      'ArrowUp': 'up',
      'ArrowDown': 'down',
      'ArrowLeft': 'left',
      'ArrowRight': 'right',
      'Delete': 'delete',
      'Home': 'home',
      'End': 'end',
      'PageUp': 'pageup',
      'PageDown': 'pagedown',
      ' ': 'space',
      'Control': 'control',
      'Alt': 'alt',
      'Shift': 'shift',
      'Meta': 'command',
      'CapsLock': 'capslock',
    }

    if (key.startsWith('F') && key.length <= 3) {
      return key.toLowerCase()
    }

    return keyMap[key] || key.toLowerCase()
  }

  get isAvailable(): boolean {
    return robot != null
  }
}
