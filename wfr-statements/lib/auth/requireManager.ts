import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { MANAGER_COOKIE, readManagerToken } from './session'

/** For server components. Redirects to the manager login when there is no valid manager session. */
export async function requireManager(): Promise<void> {
  const store = await cookies()
  if (!(await readManagerToken(store.get(MANAGER_COOKIE)?.value))) redirect('/manage')
}
