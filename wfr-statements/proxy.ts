import { NextResponse, type NextRequest } from 'next/server'
import {
  SESSION_COOKIE,
  createSessionToken,
  readSessionToken,
  sessionCookieOptions,
} from '@/lib/auth/session'

/**
 * Renews the session on every authenticated request, which is what turns the
 * ten-minute expiry into an *idle* timeout rather than an absolute one. A
 * contractor part-way through a fortnight must never be logged out and lose
 * their entries; an unattended phone must lock.
 *
 * Renewal has to happen here rather than in requireContractorId: a server
 * component cannot set a cookie during render.
 *
 * This file is `proxy.ts`, not `middleware.ts`: Next.js 16 renamed the
 * convention (and the exported function) to Proxy and deprecated the old
 * name — see node_modules/next/dist/docs/01-app/03-api-reference/
 * 03-file-conventions/proxy.md. Proxy defaults to the Node.js runtime in 16,
 * so `jose` runs here without an edge-compatibility shim; keep
 * lib/auth/session.ts dependent on `jose` alone regardless, so this stays
 * true if the runtime ever changes.
 */
export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  const contractorId = await readSessionToken(token)
  if (!contractorId) return NextResponse.next()

  const response = NextResponse.next()
  response.cookies.set(SESSION_COOKIE, await createSessionToken(contractorId), sessionCookieOptions())
  return response
}

export const config = {
  // Only authenticated *contractor* surfaces. The login page and /api/login
  // are deliberately excluded — there is no session to renew there.
  //
  // `/manage` is deliberately excluded too. The management session is an
  // 8-hour absolute token by design, not an idle one: it is a shared
  // credential on a desktop, not a contractor's phone carried between jobs,
  // and the ten-minute idle timeout exists to protect the latter. Adding
  // /manage here would silently convert it to a session that never expires
  // while a tab stays open. This is a decision, not an oversight.
  matcher: ['/statements/:path*', '/api/statements', '/api/session/:path*'],
}
