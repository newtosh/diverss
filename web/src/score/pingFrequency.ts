import type { ScoreResult, ScoreTimeframe } from '@/score/client'

/** Semantic severity for ping frequency (quiet → noisy). */
export type PingBand = 'success' | 'info' | 'warning' | 'danger'

export interface PingFrequency {
  score: number
  band: PingBand
  posts: number
  burdenUnknown: boolean
  tooltip: string
}

const DAYS: Record<ScoreTimeframe, number> = { '1d': 1, '7d': 7, '30d': 30 }

const BAND_LABEL: Record<PingBand, string> = {
  success: 'Success',
  info: 'Info',
  warning: 'Warning',
  danger: 'Danger',
}

function postsFor(s: ScoreResult, tf: ScoreTimeframe): number {
  if (tf === '1d') return s.posts1d ?? 0
  if (tf === '7d') return s.posts7d ?? 0
  return s.posts30d ?? 0
}

/** 0–24 success · 25–49 info · 50–74 warning · 75–100 danger */
export function bandFor(score: number): PingBand {
  if (score <= 24) return 'success'
  if (score <= 49) return 'info'
  if (score <= 74) return 'warning'
  return 'danger'
}

export function pingFrequencyFor(
  s: ScoreResult | undefined,
  timeframe: ScoreTimeframe,
): PingFrequency | null {
  if (!s || s.health !== 'ok' || s.velocityUnknown) return null
  const posts = postsFor(s, timeframe)
  const days = DAYS[timeframe]
  const p = posts / days
  const cadence = Math.min(100, Math.round(p * 50))
  const burdenUnknown = s.avgWords == null || s.avgWords <= 0
  const burden = burdenUnknown
    ? 1
    : Math.min(1.8, Math.max(0.6, s.avgWords! / 400))
  const score = Math.min(100, Math.round(cadence * burden))
  const band = bandFor(score)
  const burdenNote = burdenUnknown
    ? 'Signal length unknown — cadence only.'
    : `Avg ~${Math.round(s.avgWords!)} words/post.`
  const tooltip = `${BAND_LABEL[band]} ping frequency (${score}/100) over ${timeframe}. ${posts} ping(s) in window. ${burdenNote} Success 0–24 · Info 25–49 · Warning 50–74 · Danger 75–100.`
  return { score, band, posts, burdenUnknown, tooltip }
}

/** Radar / sonar icons by severity; danger uses a clear alert mark. */
export function radarIcon(band: PingBand): string {
  if (band === 'success') return 'tabler:radar-2'
  if (band === 'info') return 'tabler:radar'
  if (band === 'warning') return 'tabler:radar'
  return 'tabler:alert-circle'
}

/** Standard success / info / warning / danger text colors. */
export function pingBandClass(band: PingBand): string {
  if (band === 'success') return 'text-emerald-600'
  if (band === 'info') return 'text-sky-600'
  if (band === 'warning') return 'text-amber-600'
  return 'text-red-600'
}
