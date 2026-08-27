/** Sanitize an OPML document title into a download basename (no path, ends with .opml). */
export function opmlDownloadFilename(title: string, fallback = 'gardenrss-export'): string {
  const base = title
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  const stem = base || fallback
  return stem.toLowerCase().endsWith('.opml') ? stem : `${stem}.opml`
}
