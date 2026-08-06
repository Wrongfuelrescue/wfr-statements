import 'server-only'
import { getLoginState, setLoginThrottle } from '@/lib/airtable/contractors'

export const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000

export type PinResult =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'locked'; retryAfterSeconds?: number }

/** Constant-time comparison so response timing cannot leak PIN digits. */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * Throttle state is read from and written to the contractor's Airtable record
 * rather than kept in process memory, because this deploys to serverless
 * instances that do not share memory — an in-process counter would reset on
 * every cold start and be bypassable by concurrent requests.
 */
export async function verifyPin(
  contractorId: string,
  submittedPin: string,
): Promise<PinResult> {
  const state = await getLoginState(contractorId)
  const now = Date.now()

  if (state.lockedUntil !== null && state.lockedUntil > now) {
    return {
      ok: false,
      reason: 'locked',
      retryAfterSeconds: Math.ceil((state.lockedUntil - now) / 1000),
    }
  }

  // A lockout that has expired must not leave the failed-attempts counter
  // sitting at MAX_ATTEMPTS: without this, the very next wrong PIN would
  // push it to MAX_ATTEMPTS + 1 and immediately re-lock for another 15
  // minutes, giving a contractor zero real retries from their first lockout
  // onward. Observing an expired lockedUntil is exactly the signal that the
  // previous attempt count is stale and should be treated as reset.
  const failedAttempts =
    state.lockedUntil !== null && state.lockedUntil <= now ? 0 : state.failedAttempts

  // A record with no PIN set can never be logged into.
  const valid = state.pin !== '' && constantTimeEquals(state.pin, submittedPin.trim())

  if (valid) {
    await setLoginThrottle(contractorId, 0, null)
    return { ok: true }
  }

  const failures = failedAttempts + 1
  if (failures >= MAX_ATTEMPTS) {
    await setLoginThrottle(contractorId, failures, new Date(now + LOCKOUT_MS).toISOString())
    return {
      ok: false,
      reason: 'locked',
      retryAfterSeconds: Math.ceil(LOCKOUT_MS / 1000),
    }
  }

  await setLoginThrottle(contractorId, failures, null)
  return { ok: false, reason: 'invalid' }
}
