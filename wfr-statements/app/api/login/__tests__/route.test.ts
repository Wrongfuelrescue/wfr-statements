// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { POST } from '../route'
import { SESSION_MINUTES } from '@/lib/auth/session'

const VALID_ID = 'rec36VBHdVAy4XyuY'

function request(body: unknown) {
  return new Request('http://localhost/api/login', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** Serves a fixed PIN/throttle record for every Airtable GET, and accepts every PATCH. */
function mockAirtable(fields: Record<string, unknown>) {
  return vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
    if ((init?.method ?? 'GET') === 'PATCH') {
      return { ok: true, status: 200, json: async () => ({ id: VALID_ID, fields: {} }), text: async () => '{}' }
    }
    return { ok: true, status: 200, json: async () => ({ id: VALID_ID, fields }), text: async () => '{}' }
  })
}

beforeEach(() => {
  process.env.SESSION_SECRET = 'test-secret-at-least-32-bytes-long!!'
  process.env.AIRTABLE_TOKEN = 'pat_test'
  process.env.AIRTABLE_BASE_ID = 'appNMPu4UACVHBBbR'
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('POST /api/login', () => {
  it('signs in with a correct PIN and sets the session cookie', async () => {
    vi.stubGlobal('fetch', mockAirtable({ PIN: '123456' }))
    const response = await POST(request({ contractorId: VALID_ID, pin: '123456' }))
    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toContain('wfr_session=')
  })

  // PINs are stored in plaintext on the Airtable record (see
  // docs/airtable-schema-setup.md), so the session cookie is the only thing
  // standing between an intercepted or XSS-read cookie and full account
  // access. Every attribute here is deliberate and must not regress:
  // HttpOnly keeps it out of reach of injected JS, SameSite=Lax is CSRF
  // hygiene appropriate for a same-site form flow, Secure is required over
  // HTTPS in production (but must not be set in local dev over plain HTTP,
  // where it would silently break login), and Max-Age bounds a session to
  // SESSION_MINUTES regardless of Secure/host — the JWT's own expiry (see
  // lib/auth/session.ts) is a second, independent enforcement of the same
  // bound. Both are renewed on every authenticated request by proxy.ts, so
  // this is an idle timeout, not an absolute one.
  describe('session cookie attributes', () => {
    it('sets HttpOnly, SameSite=Lax, Path=/ and a ten-minute Max-Age', async () => {
      vi.stubGlobal('fetch', mockAirtable({ PIN: '123456' }))
      const response = await POST(request({ contractorId: VALID_ID, pin: '123456' }))

      const setCookie = response.headers.get('set-cookie') ?? ''
      expect(setCookie).toContain('HttpOnly')
      expect(setCookie.toLowerCase()).toContain('samesite=lax')
      expect(setCookie).toContain('Path=/')
      expect(setCookie).toContain(`Max-Age=${SESSION_MINUTES * 60}`)
    })

    it('does not set Secure outside production, so local HTTP dev logins still work', async () => {
      const originalEnv = process.env.NODE_ENV
      // @ts-expect-error -- NODE_ENV is typed readonly, but is writable at runtime.
      process.env.NODE_ENV = 'test'
      try {
        vi.stubGlobal('fetch', mockAirtable({ PIN: '123456' }))
        const response = await POST(request({ contractorId: VALID_ID, pin: '123456' }))
        const setCookie = response.headers.get('set-cookie') ?? ''
        expect(setCookie).not.toContain('Secure')
      } finally {
        // @ts-expect-error -- see above.
        process.env.NODE_ENV = originalEnv
      }
    })

    it('sets Secure in production', async () => {
      const originalEnv = process.env.NODE_ENV
      // @ts-expect-error -- NODE_ENV is typed readonly, but is writable at runtime.
      process.env.NODE_ENV = 'production'
      try {
        vi.stubGlobal('fetch', mockAirtable({ PIN: '123456' }))
        const response = await POST(request({ contractorId: VALID_ID, pin: '123456' }))
        const setCookie = response.headers.get('set-cookie') ?? ''
        expect(setCookie).toContain('Secure')
      } finally {
        // @ts-expect-error -- see above.
        process.env.NODE_ENV = originalEnv
      }
    })
  })

  it('rejects a request with a non-JSON body with a clean 400, never an unhandled crash', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const response = await POST(
      new Request('http://localhost/api/login', { method: 'POST', body: 'not json' }),
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toMatch(/select your name/i)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('rejects a missing contractorId or pin without touching Airtable', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const response = await POST(request({ pin: '123456' }))
    expect(response.status).toBe(400)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('rejects an incorrect PIN with a clean 401', async () => {
    vi.stubGlobal('fetch', mockAirtable({ PIN: '123456' }))
    const response = await POST(request({ contractorId: VALID_ID, pin: '000000' }))
    expect(response.status).toBe(401)
    expect((await response.json()).error).toMatch(/not correct/i)
  })

  // The login page serves all 21 contractor record ids unauthenticated, so
  // any caller can post an arbitrary contractorId. A malformed one (path
  // traversal, formula injection, or simple garbage) must be rejected with a
  // clean, generic 400 before it ever reaches an Airtable URL — never let it
  // reach getLoginState's fetch call and blow up as an unhandled 500.
  it('rejects a malformed contractorId with a clean 400, not a crash, and never calls Airtable', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const response = await POST(request({ contractorId: '../../etc/passwd', pin: '123456' }))

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).not.toMatch(/invalid airtable record id/i)
    expect(body.error).toMatch(/select your name/i)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns a clean 500 rather than an unhandled crash when Airtable is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fetch failed: ECONNREFUSED')))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const response = await POST(request({ contractorId: VALID_ID, pin: '123456' }))

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).not.toMatch(/ECONNREFUSED/)
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('surfaces the lockout message with minutes remaining', async () => {
    const future = new Date(Date.now() + 5 * 60 * 1000).toISOString()
    vi.stubGlobal(
      'fetch',
      mockAirtable({ PIN: '123456', 'Failed Attempts': 5, 'Locked Until': future }),
    )
    const response = await POST(request({ contractorId: VALID_ID, pin: '123456' }))
    expect(response.status).toBe(401)
    expect((await response.json()).error).toMatch(/too many incorrect attempts/i)
  })
})
