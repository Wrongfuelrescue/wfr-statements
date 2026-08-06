'use client'

import { useState } from 'react'

/**
 * The way out. `/api/logout` has always existed and cleared the session
 * cookie correctly; nothing in the UI ever called it, so a contractor on a
 * shared or borrowed phone had no way to end their session except waiting out
 * the ten-minute idle timeout.
 *
 * Placed on the home screen only, deliberately. A sign-out control inside a
 * part-filled fortnight would sit next to "Review statement" and discard
 * fourteen days of unsaved entries on a mis-tap — the same hazard PageNav
 * guards with a confirm. The home screen has nothing at stake, so it needs no
 * guard here.
 *
 * A full page load rather than a router push: the session cookie changes, and
 * every contractor screen is server-rendered from it. A client-side
 * navigation could show a cached view rendered while the contractor was still
 * signed in.
 */
export function SignOutButton() {
  const [busy, setBusy] = useState(false)

  async function handleSignOut() {
    setBusy(true)
    try {
      await fetch('/api/logout', { method: 'POST' })
    } catch {
      // Ignored on purpose. If the request never landed the cookie is still
      // set, and sending them to the sign-in page anyway is the honest
      // outcome: they will be redirected straight back if the session
      // survived, rather than being told they are signed out when they are
      // not.
    }
    window.location.href = '/'
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={busy}
      className="rounded-xl bg-white p-4 text-center text-sm font-medium shadow-sm disabled:opacity-60"
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
