import { ref } from 'vue'

const STORAGE_KEY = 'gr-theme'
type Theme = 'light' | 'dark'

function readStored(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

function systemPrefersDark(): boolean {
  try {
    return typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false
  } catch {
    return false
  }
}

export const theme = ref<Theme>(readStored() ?? (systemPrefersDark() ? 'dark' : 'light'))

function apply(t: Theme) {
  document.documentElement.dataset.theme = t
}
apply(theme.value)

export function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  try {
    localStorage.setItem(STORAGE_KEY, theme.value)
  } catch {
    // Private-browsing / storage-restricted contexts — theme still applies for this session.
  }
  apply(theme.value)
}
