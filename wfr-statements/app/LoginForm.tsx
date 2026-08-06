'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export function LoginForm({
  contractors,
}: {
  contractors: Array<{ id: string; name: string }>
}) {
  const router = useRouter()
  // Set by requireContractorId() when a session has expired.
  const timedOut = useSearchParams().get('timeout') === '1'
  const [contractorId, setContractorId] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setBusy(true)

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractorId, pin }),
      })

      if (response.ok) {
        router.push('/statements')
        return
      }

      const body = (await response.json()) as { error?: string }
      setError(body.error ?? 'Could not sign you in.')
      setPin('')
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-xl bg-white p-6 shadow-sm">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Your name
        <select
          required
          value={contractorId}
          onChange={(e) => setContractorId(e.target.value)}
          className="rounded-lg border border-gray-300 p-3 text-base"
        >
          <option value="">Select your name…</option>
          {contractors.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        PIN
        <input
          required
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          className="rounded-lg border border-gray-300 p-3 text-base tracking-widest"
        />
      </label>

      {timedOut ? (
        <p
          role="status"
          className="rounded-lg p-3 text-sm"
          style={{ background: 'var(--wfr-warning-bg)', color: 'var(--wfr-warning)' }}
        >
          You were signed out after 10 minutes of inactivity. Sign in again to carry on.
        </p>
      ) : null}

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
