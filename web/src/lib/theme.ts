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

const SURFACE_BY_THEME: Record<Theme, string> = { light: '#FFFBF3', dark: '#2B2216' }

// iOS Safari tints the status bar strip above the page using this meta,
// sampled at initial paint before Vue mounts — the static
// prefers-color-scheme tags in index.html cover that. This keeps it in
// sync after a manual theme toggle within the session.
function syncThemeColorMeta(t: Theme) {
  const color = SURFACE_BY_THEME[t]
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
  if (metas.length === 0) {
    const meta = document.createElement('meta')
    meta.name = 'theme-color'
    meta.content = color
    document.head.appendChild(meta)
    return
  }
  // Overwrite every prefers-color-scheme variant with the resolved color —
  // the manual toggle should win regardless of which media query the OS matches.
  metas.forEach((meta) => {
    meta.content = color
  })
}

function apply(t: Theme) {
  document.documentElement.dataset.theme = t
  syncThemeColorMeta(t)
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
