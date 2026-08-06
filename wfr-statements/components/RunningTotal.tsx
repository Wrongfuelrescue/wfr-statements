import { gstNote, subtotalLabel } from '@/lib/calc/notes'
import type { StatementTotals } from '@/lib/calc/types'

export function RunningTotal({ totals }: { totals: StatementTotals }) {
  const note = gstNote(totals)
  return (
    <div className="sticky bottom-0 rounded-t-xl bg-white p-4 shadow-[0_-2px_10px_rgba(0,0,0,0.08)]">
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
    </div>
  )
}
