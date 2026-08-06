import { BrandHeader } from '@/components/BrandHeader'
import { ManageNav } from '@/components/manage/ManageNav'
import { PeriodStepper } from '@/components/manage/PeriodStepper'
import { StatTile } from '@/components/manage/StatTile'
import { formatMoney } from '@/components/manage/money'
import { listRoster, listStatementsInRange } from '@/lib/airtable/management'
import { requireManager } from '@/lib/auth/requireManager'
import { buildGstPosition } from '@/lib/manage/gstPosition'
import { currentQuarter, quarterFor, stepQuarter } from '@/lib/manage/quarter'

export const dynamic = 'force-dynamic'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export default async function GstPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  await requireManager()

  const requested = (await searchParams).q
  const quarter =
    requested && ISO_DATE.test(requested) ? quarterFor(requested) : currentQuarter(new Date())

  const [statements, roster] = await Promise.all([
    listStatementsInRange(quarter.start, quarter.end),
    listRoster(),
  ])

  const position = buildGstPosition(statements, roster)

  return (
    <main className="flex flex-col gap-6">
      <BrandHeader subtitle="Management" />
      <ManageNav current="gst" />

      <PeriodStepper
        label={quarter.label}
        prevHref={`/manage/gst?q=${stepQuarter(quarter, -1).start}`}
        nextHref={`/manage/gst?q=${stepQuarter(quarter, 1).start}`}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile
          label="GST charged to WFR"
          value={formatMoney(position.totalGst)}
          hint="Input tax credit for the quarter"
        />
        <StatTile label="Work subtotal" value={formatMoney(position.totalSubtotal)} />
        <StatTile label="Statements" value={String(position.statementCount)} />
        <StatTile
          label="Unclaimable GST"
          value={formatMoney(position.unclaimableGst)}
          hint="No supplier ABN on the invoice"
          tone={position.unclaimableGst > 0 ? 'problem' : 'normal'}
        />
      </div>

      {position.noAbnCount > 0 ? (
        <div
          className="rounded-xl p-4 text-sm"
          style={{ background: 'var(--wfr-error-bg)', color: 'var(--wfr-error)' }}
        >
          <p className="font-semibold">
            {position.noAbnCount} {position.noAbnCount === 1 ? 'contractor has' : 'contractors have'}{' '}
            no ABN on file — {formatMoney(position.unclaimableGst)} of this quarter&rsquo;s GST
            cannot be claimed.
          </p>
          <p className="mt-2">
            An invoice with no supplier ABN also obliges WFR to withhold 47% of the payment,
            whether or not the contractor is registered for GST. Fix by adding the ABN to their
            INVOICE MATRIX row in Airtable.
          </p>
        </div>
      ) : null}

      {position.rows.length === 0 ? (
        <p
          className="rounded-xl bg-white p-6 text-sm shadow-sm"
          style={{ color: 'var(--wfr-text-muted)' }}
        >
          No submitted statements in this quarter.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ color: 'var(--wfr-text-muted)' }}>
                <th className="p-3 font-medium">Contractor</th>
                <th className="p-3 font-medium">GST registered</th>
                <th className="p-3 font-medium">ABN on file</th>
                <th className="p-3 text-right font-medium">Subtotal</th>
                <th className="p-3 text-right font-medium">GST</th>
              </tr>
            </thead>
            <tbody>
              {position.rows.map((row) => (
                <tr key={row.contractorId} className="border-t border-gray-100">
                  <td className="p-3 font-medium">{row.contractorName}</td>
                  <td className="p-3">{row.registered ? 'Yes' : 'No'}</td>
                  <td className="p-3">
                    {row.abnOnFile ? (
                      'Yes'
                    ) : (
                      <span style={{ color: 'var(--wfr-error)' }}>No</span>
                    )}
                  </td>
                  <td className="p-3 text-right tabular-nums">{formatMoney(row.subtotal)}</td>
                  <td className="p-3 text-right font-semibold tabular-nums">
                    {formatMoney(row.gst)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-sm" style={{ color: 'var(--wfr-text-muted)' }}>
        Reimbursements this quarter: {formatMoney(position.totalReimbursements)}. These are
        currently treated as GST-free. Whether an on-charged expense should carry GST for a
        registered contractor is still open with WFR&rsquo;s accountant — this figure is the
        exposure if that treatment changes.
      </p>
    </main>
  )
}
