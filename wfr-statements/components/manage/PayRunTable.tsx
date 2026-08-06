import Link from 'next/link'
import type { PayRunRow } from '@/lib/manage/rollup'
import { formatMoney } from './money'

function Badge({ text, tone }: { text: string; tone: 'error' | 'warning' }) {
  return (
    <span
      className="rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap"
      style={
        tone === 'error'
          ? { background: 'var(--wfr-error-bg)', color: 'var(--wfr-error)' }
          : { background: 'var(--wfr-warning-bg)', color: 'var(--wfr-warning)' }
      }
    >
      {text}
    </span>
  )
}

export function PayRunTable({ rows }: { rows: PayRunRow[] }) {
  if (rows.length === 0) {
    return (
      <p
        className="rounded-xl bg-white p-6 text-sm shadow-sm"
        style={{ color: 'var(--wfr-text-muted)' }}
      >
        No contractors are expected to submit for this fortnight.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left" style={{ color: 'var(--wfr-text-muted)' }}>
            <th className="p-3 font-medium">Contractor</th>
            <th className="p-3 font-medium">Status</th>
            <th className="p-3 text-right font-medium">Subtotal</th>
            <th className="p-3 text-right font-medium">GST</th>
            <th className="p-3 text-right font-medium">Reimb.</th>
            <th className="p-3 text-right font-medium">Total</th>
            <th className="p-3 font-medium">Reference</th>
            <th className="p-3 font-medium">PDF</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.contractorId} className="border-t border-gray-100">
              <td className="p-3 font-medium">
                {row.statement ? (
                  <Link href={`/manage/statements/${row.statement.id}`} className="underline">
                    {row.contractorName}
                  </Link>
                ) : (
                  row.contractorName
                )}
              </td>
              <td className="p-3">
                {row.statement ? (
                  <span className="flex flex-wrap items-center gap-1">
                    <span>Submitted</span>
                    {row.offCycle ? <Badge text="Off-cycle" tone="error" /> : null}
                    {row.statement.warnings ? <Badge text="Warning" tone="warning" /> : null}
                  </span>
                ) : (
                  <span style={{ color: 'var(--wfr-error)' }}>Not submitted</span>
                )}
              </td>
              <td className="p-3 text-right tabular-nums">
                {row.statement ? formatMoney(row.statement.subtotal) : '—'}
              </td>
              <td className="p-3 text-right tabular-nums">
                {row.statement ? formatMoney(row.statement.gst) : '—'}
              </td>
              <td className="p-3 text-right tabular-nums">
                {row.statement ? formatMoney(row.statement.reimbursements) : '—'}
              </td>
              <td className="p-3 text-right font-semibold tabular-nums">
                {row.statement ? formatMoney(row.statement.total) : '—'}
              </td>
              <td className="p-3 whitespace-nowrap">{row.statement?.reference || '—'}</td>
              <td className="p-3">
                {!row.statement ? (
                  '—'
                ) : row.statement.pdfUrl ? (
                  <a
                    href={row.statement.pdfUrl}
                    className="underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    PDF
                  </a>
                ) : (
                  <span style={{ color: 'var(--wfr-error)' }}>No PDF</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
