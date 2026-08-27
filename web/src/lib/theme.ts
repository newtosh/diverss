import { ref } from 'vue'

const STORAGE_KEY = 'gr-theme'
type Theme = 'light' | 'dark'

function readStored(): Theme | null {
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'light' || v === 'dark' ? v : null
}

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export const theme = ref<Theme>(readStored() ?? (systemPrefersDark() ? 'dark' : 'light'))

function apply(t: Theme) {
  document.documentElement.dataset.theme = t
}
apply(theme.value)

export function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  localStorage.setItem(STORAGE_KEY, theme.value)
  apply(theme.value)
}
