import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SESSION_COOKIE, readSessionToken } from './session'

/** For server components. Redirects to the login screen when there is no valid session. */
export async function requireContractorId(): Promise<string> {
  const store = await cookies()
  const contractorId = await readSessionToken(store.get(SESSION_COOKIE)?.value)
  // The flag lets the login screen explain the ten-minute idle timeout: a
  // contractor who is silently dumped back on a login page assumes the app
  // broke.
  if (!contractorId) redirect('/?timeout=1')
  return contractorId
}
