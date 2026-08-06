'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function ManagerLoginForm() {
  const router = useRouter()
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setBusy(true)

    try {
      const response = await fetch('/api/manage/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase }),
      })

      if (response.ok) {
        router.push('/manage/pay-run')
        return
      }

      const body = (await response.json()) as { error?: string }
      setError(body.error ?? 'Could not sign you in.')
      setPassphrase('')
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
      setPassphrase('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-xl bg-white p-6 shadow-sm">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Management passphrase
        <input
          required
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          type="password"
          autoComplete="off"
          className="rounded-lg border border-gray-300 p-3 text-base"
        />
      </label>

      {error ? (
        <p
          role="alert"
          className="rounded-lg p-3 text-sm"
          style={{ background: 'var(--wfr-error-bg)', color: 'var(--wfr-error)' }}
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="rounded-lg p-3 text-base font-semibold text-white disabled:opacity-60"
        style={{ background: 'var(--wfr-accent)' }}
      >
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
