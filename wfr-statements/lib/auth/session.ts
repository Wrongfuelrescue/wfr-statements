import { SignJWT, jwtVerify } from 'jose'

export const SESSION_COOKIE = 'wfr_session'
/**
 * Idle timeout, not an absolute lifetime. Every authenticated request mints
 * a fresh token (see proxy.ts), so continuous use never expires while an
 * unattended phone locks ten minutes after the last interaction.
 */
export const SESSION_MINUTES = 10

function secret(): Uint8Array {
  const value = process.env.SESSION_SECRET
  if (!value) throw new Error('SESSION_SECRET is not set.')
  return new TextEncoder().encode(value)
}

/** The token carries only the contractor's Airtable record ID — never rates. */
export async function createSessionToken(contractorId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(contractorId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MINUTES}m`)
    .sign(secret())
}

/**
 * The cookie settings for a session, in one place so the login route and the
 * renewing proxy cannot drift apart — a renewal written with a different path
 * or sameSite would silently create a second cookie and the contractor would
 * be logged out at the original expiry regardless.
 */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MINUTES * 60,
  }
}

export async function readSessionToken(
  token: string | undefined,
): Promise<string | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] })
    // A manager token is signed with the same secret and would otherwise
    // verify here, yielding the subject "manager" — which is then handed to
    // Airtable as a record id. Reject it as a contractor session outright.
    if (payload.role === MANAGER_ROLE) return null
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}

export const MANAGER_COOKIE = 'wfr_manager'
const MANAGER_ROLE = 'manager'
const MANAGER_HOURS = 8

/**
 * A management session. Carries no contractor identity — management is a
 * single shared credential, not a person in INVOICE MATRIX.
 */
export async function createManagerToken(): Promise<string> {
  return new SignJWT({ role: MANAGER_ROLE })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(MANAGER_ROLE)
    .setIssuedAt()
    .setExpirationTime(`${MANAGER_HOURS}h`)
    .sign(secret())
}

/**
 * The `role` claim check is load-bearing, not belt-and-braces. Contractor
 * session tokens are signed with the same SESSION_SECRET, so `jwtVerify`
 * alone accepts one — a contractor could copy their own `wfr_session` value
 * into a `wfr_manager` cookie and read every contractor's pay data. Only the
 * claim tells the two apart. Do not remove it.
 */
export async function readManagerToken(token: string | undefined): Promise<boolean> {
  if (!token) return false
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] })
    return payload.role === MANAGER_ROLE
  } catch {
    return false
  }
}
