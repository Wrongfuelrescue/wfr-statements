// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { POST } from '../route'

function request(body: unknown) {
  return new Request('http://localhost/api/manage/login', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  process.env.SESSION_SECRET = 'test-secret-at-least-32-bytes-long!!'
  process.env.MANAGER_PASSPHRASE = 'a-generated-passphrase'
})

afterEach(() => {
  delete process.env.MANAGER_PASSPHRASE
})

describe('POST /api/manage/login', () => {
  it('sets the manager cookie for the correct passphrase', async () => {
    const response = await POST(request({ passphrase: 'a-generated-passphrase' }))
    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toContain('wfr_manager=')
  })

  it('sets an httpOnly cookie', async () => {
    const response = await POST(request({ passphrase: 'a-generated-passphrase' }))
    expect(response.headers.get('set-cookie')?.toLowerCase()).toContain('httponly')
  })

  it('rejects a wrong passphrase without setting a cookie', async () => {
    const response = await POST(request({ passphrase: 'nope' }))
    expect(response.status).toBe(401)
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('rejects a request with no passphrase', async () => {
    const response = await POST(request({}))
    expect(response.status).toBe(400)
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('rejects a body that is not JSON', async () => {
    const response = await POST(
      new Request('http://localhost/api/manage/login', { method: 'POST', body: 'x' }),
    )
    expect(response.status).toBe(400)
  })

  /** Fails closed: an unconfigured deployment must accept nothing at all. */
  it('rejects every passphrase when MANAGER_PASSPHRASE is unset', async () => {
    delete process.env.MANAGER_PASSPHRASE
    const response = await POST(request({ passphrase: 'anything' }))
    expect(response.status).toBe(401)
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('never echoes the expected passphrase in an error', async () => {
    const response = await POST(request({ passphrase: 'nope' }))
    expect(JSON.stringify(await response.json())).not.toContain('a-generated-passphrase')
  })
})
