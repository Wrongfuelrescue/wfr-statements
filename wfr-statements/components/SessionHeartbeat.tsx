'use client'

import { useEffect, useRef } from 'react'

/** At most one ping every two minutes, however much the contractor types. */
const MIN_INTERVAL_MS = 2 * 60 * 1000

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'change'] as const

/**
 * Keeps an actively-used session alive. Deliberately driven by real user
 * events rather than a timer: a timer would renew an abandoned session
 * forever and defeat the ten-minute idle timeout entirely.
 */
export function SessionHeartbeat() {
  const lastPing = useRef(0)

  useEffect(() => {
    function touch() {
      const now = Date.now()
      if (now - lastPing.current < MIN_INTERVAL_MS) return
      lastPing.current = now
      // Fire and forget. A failed ping means the session has already gone,
      // which the next real request will surface with a proper message —
      // there is nothing useful to tell the contractor mid-keystroke.
      void fetch('/api/session/touch', { method: 'POST' }).catch(() => {})
    }

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, touch)
    }
    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, touch)
      }
    }
  }, [])

  return null
}
