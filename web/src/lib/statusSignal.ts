export type StatusSignal = 'ok' | 'warn' | 'danger' | 'idle'

export const SIGNAL_DOT: Record<StatusSignal, string> = {
  // No gr-success token exists yet in the design system, so emerald is kept
  // as a deliberate exception for the "OK" signal -- add a gr-success token
  // if a second consumer needs this color.
  ok: 'bg-emerald-500',
  warn: 'bg-gr-gold',
  danger: 'bg-gr-danger-strong',
  idle: 'bg-gr-border',
}

export const SIGNAL_LABEL: Record<StatusSignal, string> = {
  ok: 'OK',
  warn: 'Warning',
  danger: 'Problem',
  idle: 'Idle',
}
