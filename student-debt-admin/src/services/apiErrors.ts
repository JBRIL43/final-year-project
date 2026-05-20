type ApiErrorListener = (message: string) => void

const listeners = new Set<ApiErrorListener>()

export function subscribeApiErrors(listener: ApiErrorListener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function publishApiError(message: string) {
  for (const listener of listeners) {
    listener(message)
  }
}
