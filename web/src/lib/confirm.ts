import { ref } from 'vue'

export interface ConfirmOptions {
  title?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Styles the confirm button as destructive (red). */
  danger?: boolean
}

interface ConfirmRequest {
  message: string
  options: ConfirmOptions
  resolve: (value: boolean) => void
}

/** Single in-flight confirmation — ConfirmDialog.vue (mounted once in App.vue) renders this. */
export const confirmRequest = ref<ConfirmRequest | null>(null)

/**
 * Promise-based replacement for window.confirm(). Never blocks the render
 * thread — window.confirm() froze automated/keyboard-only interaction and
 * caused visible client timeouts.
 */
export function confirm(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  return new Promise((resolve) => {
    confirmRequest.value = { message, options, resolve }
  })
}

export function resolveConfirm(result: boolean): void {
  const req = confirmRequest.value
  if (!req) return
  confirmRequest.value = null
  req.resolve(result)
}
