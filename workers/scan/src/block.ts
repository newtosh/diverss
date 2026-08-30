/** HTTP statuses that usually mean bot/IP filtering, not a dead feed. */
export function isHostBlockHttpDetail(detail?: string): boolean {
  if (!detail) return false
  return /\bHTTP (401|403|429|503)\b/i.test(detail)
}
