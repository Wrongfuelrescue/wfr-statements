import { getRateCard } from '@/lib/airtable/contractors'
import { requireContractorId } from '@/lib/auth/requireContractor'
import { mostRecentSunday } from '@/lib/dates'
import { BrandHeader } from '@/components/BrandHeader'
import { ContractorDetails } from '@/components/ContractorDetails'
import { NoAbnWarning } from '@/components/NoAbnWarning'
import { FortnightlyForm } from './FortnightlyForm'

/**
 * Reads live Airtable rates that must be fresh per request, and the build must
 * not depend on Airtable being reachable or credentialed. Without this, Next
 * trial-renders the route at build time and a credential or network failure
 * kills the deploy.
 */
export const dynamic = 'force-dynamic'

export default async function FortnightlyPage() {
  const contractorId = await requireContractorId()
  const rates = await getRateCard(contractorId)
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4">
      <BrandHeader subtitle="Fortnightly Work Statement" />
      <ContractorDetails rates={rates} />
      {rates.abn.trim() === '' ? <NoAbnWarning /> : null}
      <FortnightlyForm rates={rates} defaultEnd={mostRecentSunday(new Date())} />
    </main>
  )
}
