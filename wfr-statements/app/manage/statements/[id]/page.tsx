import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BrandHeader } from '@/components/BrandHeader'
import { StatTile } from '@/components/manage/StatTile'
import { formatMoney } from '@/components/manage/money'
import { getStatement, listLinesForStatements } from '@/lib/airtable/management'
import { requireManager } from '@/lib/auth/requireManager'
import { formatDisplayDateWithYear } from '@/lib/dates'
import { isOnCycle } from '@/lib/manage/fortnight'

export const dynamic = 'force-dynamic'

export default async function StatementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireManager()

  const statement = await getStatement((await params).id)
  if (!statement) notFound()

  const lines = await listLinesForStatements([
    { id: statement.id, label: statement.label },
  ])

  return (
    <main className="flex flex-col gap-6">
      <BrandHeader subtitle="Management" />

      <Link href="/manage/pay-run" className="text-sm underline">
        ← Back to the pay run
      </Link>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h1 className="text-lg font-semibold">{statement.contractorName}</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--wfr-text-muted)' }}>
          {statement.type} · {formatDisplayDateWithYear(statement.periodStart)} –{' '}
          {formatDisplayDateWithYear(statement.periodEnd)}
        </p>
        <p className="mt-1 text-sm" style={{ color: 'var(--wfr-text-muted)' }}>
          {statement.reference || 'No reference'} ·{' '}
          {statement.status || 'Status blank — incomplete write'} ·{' '}
          {statement.gstRegisteredAtSubmission
            ? 'Registered for GST at submission'
            : 'Not registered for GST at submission'}
        </p>

        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          {statement.pdfUrl ? (
            <a href={statement.pdfUrl} className="underline" target="_blank" rel="noreferrer">
              Open the invoice PDF
            </a>
          ) : (
            <span style={{ color: 'var(--wfr-error)' }}>No PDF attached</span>
          )}
          {statement.supersedesId ? (
            <Link href={`/manage/statements/${statement.supersedesId}`} className="underline">
              Supersedes an earlier statement
            </Link>
          ) : null}
        </div>
      </section>

      {statement.warnings ? (
        <div
          className="rounded-xl p-4 text-sm"
          style={{ background: 'var(--wfr-warning-bg)', color: 'var(--wfr-warning)' }}
        >
          <p className="font-semibold">This statement carries a warning</p>
          <p className="mt-1">{statement.warnings}</p>
          <p className="mt-2">
            The totals and lines below are still correct — something after submission failed,
            usually the PDF or a receipt photo.
          </p>
        </div>
      ) : null}

      {!isOnCycle(statement.periodEnd) ? (
        <div
          className="rounded-xl p-4 text-sm"
          style={{ background: 'var(--wfr-warning-bg)', color: 'var(--wfr-warning)' }}
        >
          Period ends {statement.periodEnd}, which is not a pay-run fortnight ending. The amount
          is unaffected — the contractor picked the wrong fortnight-ending date.
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Subtotal" value={formatMoney(statement.subtotal)} />
        <StatTile label="GST" value={formatMoney(statement.gst)} />
        <StatTile label="Reimbursements" value={formatMoney(statement.reimbursements)} />
        <StatTile label="Total" value={formatMoney(statement.total)} />
      </div>

      {lines.length === 0 ? (
        <p
          className="rounded-xl bg-white p-6 text-sm shadow-sm"
          style={{ color: 'var(--wfr-error)' }}
        >
          This statement has no line items. If its status is blank, the write failed partway
          through — do not reconcile against it.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ color: 'var(--wfr-text-muted)' }}>
                <th className="p-3 font-medium">Date</th>
                <th className="p-3 font-medium">Line type</th>
                <th className="p-3 text-right font-medium">Qty</th>
                <th className="p-3 text-right font-medium">Unit rate</th>
                <th className="p-3 text-right font-medium">Amount</th>
                <th className="p-3 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className="border-t border-gray-100">
                  <td className="p-3 whitespace-nowrap">{line.date ?? '—'}</td>
                  <td className="p-3">{line.lineType}</td>
                  <td className="p-3 text-right tabular-nums">{line.quantity}</td>
                  <td className="p-3 text-right tabular-nums">{formatMoney(line.unitRate)}</td>
                  <td className="p-3 text-right font-semibold tabular-nums">
                    {formatMoney(line.amount)}
                  </td>
                  <td className="p-3">{line.description || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
