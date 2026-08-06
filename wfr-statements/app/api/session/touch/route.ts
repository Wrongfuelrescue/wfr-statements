import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { readSessionToken, SESSION_COOKIE } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

/**
 * Does nothing but exist. Filling in a fortnight makes no network requests
 * for minutes at a time, so request-renewal alone would expire a contractor
 * who is actively typing. The client pings this while the contractor is
 * genuinely interacting; the proxy renews the cookie on the way through. No
 * interaction means no ping, so an abandoned session still expires — which is
 * the entire point of the change.
 */
export async function POST() {
  const store = await cookies()
  const contractorId = await readSessionToken(store.get(SESSION_COOKIE)?.value)
  if (!contractorId) return NextResponse.json({ ok: false }, { status: 401 })
  return NextResponse.json({ ok: true })
}
