// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createManagerToken,
  createSessionToken,
  readManagerToken,
  readSessionToken,
} from '../session'

beforeEach(() => {
  process.env.SESSION_SECRET = 'test-secret-at-least-32-bytes-long!!'
})

describe('session tokens', () => {
  it('round-trips a contractor id', async () => {
    const token = await createSessionToken('rec36VBHdVAy4XyuY')
    expect(await readSessionToken(token)).toBe('rec36VBHdVAy4XyuY')
  })

  it('returns null for a missing token', async () => {
    expect(await readSessionToken(undefined)).toBeNull()
  })

  it('returns null for a tampered token', async () => {
    const token = await createSessionToken('rec36VBHdVAy4XyuY')
    const tampered = token.slice(0, -4) + 'aaaa'
    expect(await readSessionToken(tampered)).toBeNull()
  })

  it('returns null for a token signed with a different secret', async () => {
    const token = await createSessionToken('rec36VBHdVAy4XyuY')
    process.env.SESSION_SECRET = 'a-completely-different-secret-value!!'
    expect(await readSessionToken(token)).toBeNull()
  })

  it('expires a token ten minutes after it was issued', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-08-05T00:00:00Z'))
      const token = await createSessionToken('recAAAAAAAAAAAAAA')

      vi.setSystemTime(new Date('2026-08-05T00:09:00Z'))
      expect(await readSessionToken(token)).toBe('recAAAAAAAAAAAAAA')

      vi.setSystemTime(new Date('2026-08-05T00:11:00Z'))
      expect(await readSessionToken(token)).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('carries no data beyond the contractor id', async () => {
    const token = await createSessionToken('rec36VBHdVAy4XyuY')
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
    )
    expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'sub'])
  })
})

describe('manager tokens', () => {
  it('accepts a token it created', async () => {
    expect(await readManagerToken(await createManagerToken())).toBe(true)
  })

  it('rejects a missing token', async () => {
    expect(await readManagerToken(undefined)).toBe(false)
  })

  it('rejects a garbage token', async () => {
    expect(await readManagerToken('not.a.jwt')).toBe(false)
  })

  it('rejects a token signed with a different secret', async () => {
    const token = await createManagerToken()
    process.env.SESSION_SECRET = 'a-completely-different-secret-value!!'
    expect(await readManagerToken(token)).toBe(false)
  })

  /**
   * The security-critical case. Both tokens are signed with the same
   * SESSION_SECRET, so a contractor's token verifies cryptographically —
   * only the role claim tells the two apart. If this ever passes, a
   * contractor can rename their own cookie and read every contractor's pay.
   */
  it('rejects a valid contractor token', async () => {
    const contractorToken = await createSessionToken('rec36VBHdVAy4XyuY')
    expect(await readManagerToken(contractorToken)).toBe(false)
  })

  /**
   * The mirror of the case above. Without this, a manager token read as a
   * contractor session yields the subject "manager", which is then handed to
   * Airtable as a record id — an ugly 500 rather than a clean redirect.
   */
  it('is not accepted as a contractor session', async () => {
    expect(await readSessionToken(await createManagerToken())).toBeNull()
  })
})
