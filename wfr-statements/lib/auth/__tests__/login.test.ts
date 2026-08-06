import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { verifyPin, MAX_ATTEMPTS } from '../login'

vi.mock('@/lib/airtable/contractors', () => ({
  getLoginState: vi.fn(),
  setLoginThrottle: vi.fn(),
}))

import { getLoginState, setLoginThrottle } from '@/lib/airtable/contractors'

function state(
  overrides: Partial<{ pin: string; failedAttempts: number; lockedUntil: number | null }> = {},
) {
  return {
    pin: '123456',
    failedAttempts: 0,
    lockedUntil: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.mocked(getLoginState).mockResolvedValue(state())
  vi.mocked(setLoginThrottle).mockResolvedValue(undefined)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('verifyPin', () => {
  it('accepts the correct PIN and clears the throttle', async () => {
    expect(await verifyPin('recTest', '123456')).toEqual({ ok: true })
    expect(setLoginThrottle).toHaveBeenCalledWith('recTest', 0, null)
  })

  it('tolerates surrounding whitespace in the submitted PIN', async () => {
    expect(await verifyPin('recTest', ' 123456 ')).toEqual({ ok: true })
  })

  it('rejects an incorrect PIN and increments the stored count by one', async () => {
    vi.mocked(getLoginState).mockResolvedValue(state({ failedAttempts: 1 }))
    const result = await verifyPin('recTest', '000000')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('invalid')
    expect(setLoginThrottle).toHaveBeenCalledWith('recTest', 2, null)
  })

  it('rejects login when no PIN is set on the record, even when "" is submitted', async () => {
    vi.mocked(getLoginState).mockResolvedValue(state({ pin: '' }))
    const result = await verifyPin('recTest', '')
    expect(result.ok).toBe(false)
  })

  it('locks the account after the maximum failed attempts, writing a future Locked Until', async () => {
    vi.mocked(getLoginState).mockResolvedValue(state({ failedAttempts: MAX_ATTEMPTS - 1 }))
    const result = await verifyPin('recTest', 'wrong!')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('locked')
      expect(result.retryAfterSeconds).toBeGreaterThan(0)
    }
    const [, failures, lockedUntil] = vi.mocked(setLoginThrottle).mock.calls[0]
    expect(failures).toBe(MAX_ATTEMPTS)
    expect(typeof lockedUntil).toBe('string')
    expect(Date.parse(lockedUntil as string)).toBeGreaterThan(Date.now())
  })

  it('rejects a stored future lockedUntil without comparing the PIN', async () => {
    vi.mocked(getLoginState).mockResolvedValue(state({ lockedUntil: Date.now() + 60_000 }))
    const result = await verifyPin('recTest', '123456')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('locked')
    expect(setLoginThrottle).not.toHaveBeenCalled()
  })

  it('does not block a correct PIN when the stored lockedUntil is in the past', async () => {
    vi.mocked(getLoginState).mockResolvedValue(
      state({ lockedUntil: Date.now() - 60_000, failedAttempts: MAX_ATTEMPTS }),
    )
    expect(await verifyPin('recTest', '123456')).toEqual({ ok: true })
  })

  it('resets the failed-attempts counter once a past lockout is observed, so a single wrong PIN does not immediately re-lock', async () => {
    // The stored counter is still sitting at MAX_ATTEMPTS from the lockout
    // that has since expired. Without a reset, this single wrong PIN would
    // push failures to MAX_ATTEMPTS + 1 and re-lock for another 15 minutes —
    // giving the contractor zero real retries from here on.
    vi.mocked(getLoginState).mockResolvedValue(
      state({ lockedUntil: Date.now() - 60_000, failedAttempts: MAX_ATTEMPTS }),
    )
    const result = await verifyPin('recTest', 'wrong!')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('invalid')
    expect(setLoginThrottle).toHaveBeenCalledWith('recTest', 1, null)
  })

  it('reads and writes throttle state per contractor id', async () => {
    await verifyPin('recA', '123456')
    await verifyPin('recB', '123456')
    expect(getLoginState).toHaveBeenCalledWith('recA')
    expect(getLoginState).toHaveBeenCalledWith('recB')
  })
})
