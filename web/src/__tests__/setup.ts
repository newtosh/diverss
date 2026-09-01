import 'fake-indexeddb/auto'
import { installMemoryLocalStorage } from './memoryStorage'

try {
  localStorage.removeItem('')
} catch {
  installMemoryLocalStorage()
}

// jsdom implements neither ResizeObserver nor pointer-capture, both of
// which Reka UI's Popper-based positioning (Popover, DropdownMenu) and
// pointer-driven dismiss behavior read during tests.
if (typeof ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
}

if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {}
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {}
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}
