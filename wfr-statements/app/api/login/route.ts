import { NextResponse } from 'next/server'
import { InvalidRecordIdError } from '@/lib/airtable/recordId'
import { verifyPin } from '@/lib/auth/login'
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth/session'

/**
 * Deliberately generic. The underlying error may carry an Airtable response
 * body or a stack trace — never safe to show a contractor trying to sign in.
 */
const LOGIN_FAILED = 'Something went wrong signing you in. Please try again.'

export async function POST(request: Request) {
  let body: { contractorId?: string; pin?: string }
  try {
    body = (await request.json()) as { contractorId?: string; pin?: string }
  } catch {
    return NextResponse.json({ error: 'Select your name and enter your PIN.' }, { status: 400 })
  }

  const { contractorId, pin } = body

  if (!contractorId || !pin) {
    return NextResponse.json({ error: 'Select your name and enter your PIN.' }, { status: 400 })
  }

  // The login page is unauthenticated by design (a contractor has no session
  // yet), and all 21 contractor record ids are served unauthenticated to it —
  // so this route has no session to fall back on if Airtable is unreachable
  // or contractorId turns out not to be a real, well-formed record id. Both
  // must produce a clean response rather than an unhandled 500 HTML page.
  let result
  try {
    result = await verifyPin(contractorId, pin)
  } catch (error) {
    if (error instanceof InvalidRecordIdError) {
      return NextResponse.json({ error: 'Select your name and enter your PIN.' }, { status: 400 })
    }
    console.error('Failed to verify PIN:', error)
    return NextResponse.json({ error: LOGIN_FAILED }, { status: 500 })
  }

  if (!result.ok) {
    const message =
      result.reason === 'locked'
        ? `Too many incorrect attempts. Try again in ${Math.ceil(
            (result.retryAfterSeconds ?? 0) / 60,
          )} minutes.`
        : 'That PIN is not correct.'
    return NextResponse.json({ error: message }, { status: 401 })
  }

  try {
    const response = NextResponse.json({ ok: true })
    response.cookies.set(
      SESSION_COOKIE,
      await createSessionToken(contractorId),
      sessionCookieOptions(),
    )
    return response
  } catch (error) {
    console.error('Failed to create session after a correct PIN:', error)
    return NextResponse.json({ error: LOGIN_FAILED }, { status: 500 })
  }
}
