import { listContractors } from '@/lib/airtable/contractors'
import { BrandHeader } from '@/components/BrandHeader'
import { LoginForm } from './LoginForm'

/**
 * This screen reads live Airtable data that must be fresh per request, and the
 * build must not depend on Airtable being reachable or credentialed. Without
 * this, Next trial-renders the route at build time and a credential or network
 * failure kills the deploy.
 */
export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const contractors = await listContractors()
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4">
      <BrandHeader subtitle="Contractor Statements" />
      <LoginForm contractors={contractors} />
    </main>
  )
}
