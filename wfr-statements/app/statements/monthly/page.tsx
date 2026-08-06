import { getRateCard } from '@/lib/airtable/contractors'
import { requireContractorId } from '@/lib/auth/requireContractor'
import { BrandHeader } from '@/components/BrandHeader'
import { ContractorDetails } from '@/components/ContractorDetails'
import { NoAbnWarning } from '@/components/NoAbnWarning'
import { MonthlyForm } from './MonthlyForm'

/** See app/page.tsx — the build must not depend on Airtable reachability. */
export const dynamic = 'force-dynamic'

export default async function MonthlyPage() {
  const contractorId = await requireContractorId()
  const rates = await getRateCard(contractorId)
  const now = new Date()
  const defaultMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4">
      <BrandHeader subtitle="Monthly Performance Bonus Statement" />
      <ContractorDetails rates={rates} />
      {rates.abn.trim() === '' ? <NoAbnWarning /> : null}
      <MonthlyForm rates={rates} defaultMonth={defaultMonth} />
    </main>
  )
}
