import 'server-only'

/** Constant-time comparison so response timing cannot leak the passphrase. */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * There is deliberately no lockout here, unlike the contractor PIN path.
 * Throttle state would need somewhere to live that survives a serverless cold
 * start — for the contractor PIN that is their Airtable record, and adding a
 * table or settings row for one shared credential is not worth it. The
 * protection is passphrase entropy instead: MANAGER_PASSPHRASE must be
 * generated (`openssl rand -base64 24`), not chosen.
 */
export function verifyManagerPassphrase(submitted: string): boolean {
  const expected = process.env.MANAGER_PASSPHRASE
  // An unset (or empty) variable must reject everything rather than accept an
  // empty submission — fail closed.
  if (!expected) return false
  return constantTimeEquals(expected, submitted)
}
