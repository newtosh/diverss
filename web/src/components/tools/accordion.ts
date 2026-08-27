/** Exclusive accordion: at most one panel id open. */
export function nextExpandedId<T extends string>(
  current: T | null,
  toggled: T,
): T | null {
  return current === toggled ? null : toggled
}

/** Prefer first connected live reader; otherwise all collapsed. */
export function defaultExpandedReaderId(
  connected: { miniflux?: boolean; freshrss?: boolean },
): 'miniflux' | 'freshrss' | null {
  if (connected.miniflux) return 'miniflux'
  if (connected.freshrss) return 'freshrss'
  return null
}
