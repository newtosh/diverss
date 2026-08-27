import 'fake-indexeddb/auto'
import { installMemoryLocalStorage } from './memoryStorage'

try {
  localStorage.removeItem('')
} catch {
  installMemoryLocalStorage()
}
