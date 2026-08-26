import { opmlDownloadFilename } from '@/opml/filename'

/** Trigger a browser download of OPML text; returns true when the download was started. */
export function downloadOpmlBackup(
  opml: string,
  title = 'reader-backup',
): boolean {
  if (typeof document === 'undefined') return false
  const blob = new Blob([opml], { type: 'application/xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = opmlDownloadFilename(title, 'reader-backup')
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return true
}
