import { NextResponse } from 'next/server'
import { verifyManagerPassphrase } from '@/lib/auth/managerPassphrase'
import { createManagerToken, MANAGER_COOKIE } from '@/lib/auth/session'

/** Deliberately generic — never say whether a passphrase is even configured. */
const WRONG = 'That passphrase is not correct.'

export async function POST(request: Request) {
  let body: { passphrase?: string }
  try {
    body = (await request.json()) as { passphrase?: string }
  } catch {
    return NextResponse.json({ error: 'Enter the management passphrase.' }, { status: 400 })
  }

  if (!body.passphrase) {
    return NextResponse.json({ error: 'Enter the management passphrase.' }, { status: 400 })
  }

  if (!verifyManagerPassphrase(body.passphrase)) {
    return NextResponse.json({ error: WRONG }, { status: 401 })
  }

  try {
    const response = NextResponse.json({ ok: true })
    response.cookies.set(MANAGER_COOKIE, await createManagerToken(), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 8,
    })
    return response
  } catch (error) {
    console.error('Failed to create a manager session:', error)
    return NextResponse.json(
      { error: 'Something went wrong signing you in. Please try again.' },
      { status: 500 },
    )
  }
}
