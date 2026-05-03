import { useEffect, useRef, useCallback } from 'react'

/**
 * Polls a callback function at a given interval.
 * Stops polling when the component unmounts.
 * Does NOT poll when the browser tab is hidden (saves resources).
 *
 * @param callback  Async function to call on each tick
 * @param intervalMs  Polling interval in milliseconds (default 30s)
 * @param enabled  Set to false to pause polling (e.g. while a dialog is open)
 */
export function usePolling(
  callback: () => Promise<void> | void,
  intervalMs = 30_000,
  enabled = true
) {
  const savedCallback = useRef(callback)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Always keep the ref up to date so stale closures don't cause issues
  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  const start = useCallback(() => {
    if (timerRef.current) return
    timerRef.current = setInterval(() => {
      // Skip polling when the tab is hidden
      if (document.visibilityState === 'hidden') return
      savedCallback.current()
    }, intervalMs)
  }, [intervalMs])

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      stop()
      return
    }
    start()
    return stop
  }, [enabled, start, stop])
}
