import Link from 'next/link'
import { getRateCard } from '@/lib/airtable/contractors'
import { requireContractorId } from '@/lib/auth/requireContractor'
import { BrandHeader } from '@/components/BrandHeader'
import { ContractorDetails } from '@/components/ContractorDetails'
import { ToolDisclaimer } from '@/components/ToolDisclaimer'

/**
 * This screen reads live Airtable data that must be fresh per request, and the
 * build must not depend on Airtable being reachable or credentialed. Without
 * this, Next trial-renders the route at build time and a credential or network
 * failure kills the deploy. Do not rely on `requireContractorId()` calling
 * `cookies()` before `getRateCard()` to get this for free — that's implicit
 * call-order behaviour, not a declared contract.
 */
export const dynamic = 'force-dynamic'

export default async function StatementsPage() {
  const contractorId = await requireContractorId()
  const rates = await getRateCard(contractorId)

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-4 pb-10">
      <BrandHeader subtitle="Contractor Statements" />

      <ContractorDetails rates={rates} />

      {/*
        Above the two submission choices, not below them: the disclaimer says
        using this tool is optional, which is only meaningful to a contractor
        who reads it before they start rather than after they have finished.
      */}
      <ToolDisclaimer />

      <nav className="flex flex-col gap-4">
        <Link
          href="/statements/fortnightly"
          className="rounded-xl bg-white p-5 shadow-sm"
          style={{ borderLeft: '6px solid var(--wfr-primary)' }}
        >
          <p className="text-lg font-semibold">Fortnightly Work Statement</p>
          <p className="text-sm" style={{ color: 'var(--wfr-text-muted)' }}>
            Itemise each day — shifts, additional labour, servicing and reimbursements.
          </p>
        </Link>

        <Link
          href="/statements/monthly"
          className="rounded-xl bg-white p-5 shadow-sm"
          style={{ borderLeft: '6px solid var(--wfr-accent)' }}
        >
          <p className="text-lg font-semibold">Monthly Performance Bonus Statement</p>
          <p className="text-sm" style={{ color: 'var(--wfr-text-muted)' }}>
            End-of-month Google review and fuel filter sales bonuses.
          </p>
        </Link>

        <Link
          href="/statements/submissions"
          className="rounded-xl bg-white p-4 text-center text-sm font-medium shadow-sm"
        >
          View my previous submissions
        </Link>
      </nav>

      <p className="text-center text-xs" style={{ color: 'var(--wfr-text-muted)' }}>
        The document you generate is your invoice to Wrong Fuel Rescue. Check your
        details above before submitting.
      </p>
    </main>
  )
}
