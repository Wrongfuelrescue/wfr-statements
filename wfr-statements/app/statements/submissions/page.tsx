import Link from 'next/link'
import { listStatementsForContractor } from '@/lib/airtable/statements'
import { requireContractorId } from '@/lib/auth/requireContractor'
import { formatDisplayDateWithYear } from '@/lib/dates'
import { BrandHeader } from '@/components/BrandHeader'

/** See app/statements/page.tsx — the build must not depend on Airtable reachability. */
export const dynamic = 'force-dynamic'

export default async function SubmissionsPage() {
  const contractorId = await requireContractorId()
  const statements = await listStatementsForContractor(contractorId)

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-4 pb-10">
      <BrandHeader subtitle="My submissions" />

      {statements.length === 0 ? (
        <div className="rounded-xl bg-white p-6 text-center text-sm shadow-sm">
          <p>You have not submitted any statements yet.</p>
          <p className="mt-2 text-xs" style={{ color: 'var(--wfr-text-muted)' }}>
            Just submitted one and don&apos;t see it here? It can take a moment to
            appear — if it&apos;s still missing after a refresh, contact WFR.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {statements.map((s) => (
            <li key={s.id} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{s.type}</p>
                  <p className="text-sm" style={{ color: 'var(--wfr-text-muted)' }}>
                    {`${formatDisplayDateWithYear(s.periodStart)} – ${formatDisplayDateWithYear(s.periodEnd)}`}
                  </p>
                </div>
                <p className="font-semibold" style={{ color: 'var(--wfr-accent)' }}>
                  ${s.total.toFixed(2)}
                </p>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-xs">
                {s.reference ? (
                  <p style={{ color: 'var(--wfr-text-muted)' }}>Ref: {s.reference}</p>
                ) : null}
                {/*
                  A row can be Status="Submitted" (so it appears here) with no
                  stored PDF — attachPdfToStatement runs after Status is set,
                  and can fail on its own (see Warnings on the Airtable
                  record). Rendering a link against a null pdfUrl would be a
                  broken link with nothing behind it, so it's simply omitted.
                */}
                {s.pdfUrl ? (
                  <a
                    href={s.pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium underline"
                    style={{ color: 'var(--wfr-accent)' }}
                  >
                    Download PDF
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/statements"
        className="rounded-xl bg-white p-4 text-center text-sm font-medium shadow-sm"
      >
        Return to home screen
      </Link>
    </main>
  )
}
