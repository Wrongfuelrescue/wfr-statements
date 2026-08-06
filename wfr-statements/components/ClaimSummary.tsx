'use client'

import { formatDisplayDate } from '@/lib/dates'
import { gstNote, subtotalLabel } from '@/lib/calc/notes'
import type { StatementTotals } from '@/lib/calc/types'

/**
 * The itemised line list plus the totals block. Shared by `StatementReview`
 * (before submission) and `SubmissionSuccess` (after submission) so a
 * contractor sees exactly the same claim in both places — including one who
 * submitted by accident and needs to see what actually went.
 */
export function ClaimSummary({ totals }: { totals: StatementTotals }) {
  const note = gstNote(totals)
  return (
    <>
      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold">Itemised claim</h2>
        <ul className="flex flex-col divide-y divide-gray-100">
          {totals.lines.map((line, i) => (
            <li key={i} className="flex items-start justify-between gap-3 py-2 text-sm">
              <div>
                <p className="font-medium">{line.lineType}</p>
                <p style={{ color: 'var(--wfr-text-muted)' }}>
                  <span>{line.date ? formatDisplayDate(line.date) : 'For the period'}</span>
                  {` · ${line.quantity} × $${line.unitRate.toFixed(2)}`}
                  {line.description ? ` · ${line.description}` : ''}
                </p>
              </div>
              <p className="font-semibold">${line.amount.toFixed(2)}</p>
            </li>
          ))}
        </ul>
        {totals.note ? (
          <p
            className="mt-2 border-t border-gray-100 pt-2 text-sm"
            style={{ color: 'var(--wfr-text-muted)' }}
          >
            {totals.note}
          </p>
        ) : null}
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <dl className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <dt>{subtotalLabel(totals)}</dt>
            <dd>${totals.workSubtotal.toFixed(2)}</dd>
          </div>
          {totals.gstRegistered ? (
            <div className="flex justify-between">
              <dt>GST (10%)</dt>
              <dd>${totals.gst.toFixed(2)}</dd>
            </div>
          ) : null}
          {totals.reimbursements > 0 ? (
            <div className="flex justify-between">
              <dt>Reimbursements (no GST)</dt>
              <dd>${totals.reimbursements.toFixed(2)}</dd>
            </div>
          ) : null}
          <div
            className="mt-1 flex justify-between border-t border-gray-200 pt-2 text-base font-semibold"
            style={{ color: 'var(--wfr-accent)' }}
          >
            <dt>Total claimed</dt>
            <dd>${totals.total.toFixed(2)}</dd>
          </div>
        </dl>
        {note ? (
          <p className="mt-2 text-xs" style={{ color: 'var(--wfr-text-muted)' }}>
            {note}
          </p>
        ) : null}
      </section>
    </>
  )
}
