'use client'

import type { Reimbursement } from '@/lib/calc/types'
import type { Receipt } from '@/lib/receipts/types'

export function ReimbursementSection({
  value,
  onChange,
  receipt,
  onReceiptChange,
  disabled = false,
}: {
  value: Reimbursement
  onChange: (next: Reimbursement) => void
  receipt: Receipt | null
  onReceiptChange: (file: File | null) => void
  disabled?: boolean
}) {
  const hasAmount = value.amount > 0
  const needsDescription = hasAmount && value.description.trim() === ''

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold">Reimbursements</h2>
      <p className="text-xs" style={{ color: 'var(--wfr-text-muted)' }}>
        One total for the whole fortnight. If you had several expenses, add them
        up and describe them together.
      </p>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Amount
        <input
          type="number"
          min={0}
          step={0.01}
          disabled={disabled}
          value={value.amount || ''}
          onChange={(e) =>
            onChange({ ...value, amount: Math.max(0, Number(e.target.value) || 0) })
          }
          className="rounded-lg border border-gray-300 p-3 text-base"
        />
      </label>

      {hasAmount ? (
        <>
          <label className="flex flex-col gap-1 text-sm font-medium">
            What was it for?
            <input
              type="text"
              disabled={disabled}
              value={value.description}
              onChange={(e) => onChange({ ...value, description: e.target.value })}
              className="rounded-lg border border-gray-300 p-3 text-base"
            />
          </label>

          {needsDescription ? (
            <p
              role="alert"
              className="rounded-lg p-3 text-sm"
              style={{ background: 'var(--wfr-warning-bg)', color: 'var(--wfr-warning)' }}
            >
              Tell us what this reimbursement was for before you submit.
            </p>
          ) : null}

          <label className="flex flex-col gap-1 text-sm font-medium">
            Receipt photo (optional)
            <input
              type="file"
              accept="image/*"
              capture="environment"
              disabled={disabled}
              onChange={(e) => {
                onReceiptChange(e.target.files?.[0] ?? null)
                // Clear so selecting the same file again still fires a change event —
                // reselecting the same photo is the natural retry after a failed upload.
                e.target.value = ''
              }}
              className="text-base"
            />
          </label>

          {receipt ? (
            <p className="text-xs" style={{ color: 'var(--wfr-text-muted)' }}>
              {`Attached: ${receipt.filename}`}
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
