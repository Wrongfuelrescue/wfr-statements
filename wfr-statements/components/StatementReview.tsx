'use client'

import { ClaimSummary } from './ClaimSummary'
import { PageNav } from './PageNav'
import type { StatementTotals } from '@/lib/calc/types'
import { MAX_INVOICE_NUMBER_LENGTH } from '@/lib/invoice/invoiceNumber'
import { CONTRACTOR_DECLARATION } from '@/lib/invoice/declaration'

export function StatementReview({
  totals,
  periodLabel,
  invoiceNumber,
  onInvoiceNumberChange,
  declarationAccepted,
  onDeclarationChange,
  busy,
  error,
  onBack,
  onConfirm,
}: {
  totals: StatementTotals
  periodLabel: string
  invoiceNumber: string
  onInvoiceNumberChange: (next: string) => void
  declarationAccepted: boolean
  onDeclarationChange: (next: boolean) => void
  busy: boolean
  error: string
  onBack: () => void
  onConfirm: () => void
}) {
  // Stops the contractor here as well as at the route handler, which rejects
  // a blank number with a 400 — the server check is the real one.
  const invoiceNumberBlank = invoiceNumber.trim() === ''

  return (
    <div className="flex flex-col gap-4 pb-4">
      <section className="rounded-xl bg-white p-4 shadow-sm">
        <p className="text-sm font-medium">Period</p>
        <p className="text-base">{periodLabel}</p>
      </section>

      <ClaimSummary totals={totals} />

      {error ? (
        <p
          role="alert"
          className="rounded-lg p-3 text-sm"
          style={{ background: 'var(--wfr-error-bg)', color: 'var(--wfr-error)' }}
        >
          {error}
        </p>
      ) : null}

      <label className="flex flex-col gap-1 rounded-xl bg-white p-4 text-sm font-medium shadow-sm">
        Invoice number
        <input
          type="text"
          value={invoiceNumber}
          onChange={(e) => onInvoiceNumberChange(e.target.value)}
          maxLength={MAX_INVOICE_NUMBER_LENGTH}
          className="rounded-lg border border-gray-300 p-3 text-base"
        />
        <span className="text-xs font-normal" style={{ color: 'var(--wfr-text-muted)' }}>
          Your own invoice number. We suggest one — change it to match your sequence.
        </span>
        {/*
          An unticked declaration is obvious on sight; a cleared text field is
          not. Without this, a contractor who emptied the field to type their
          own number met a Confirm button that simply did nothing and said
          nothing about why.
        */}
        {invoiceNumberBlank ? (
          <span className="text-xs font-normal" style={{ color: 'var(--wfr-error)' }}>
            Enter an invoice number before you submit.
          </span>
        ) : null}
      </label>

      {/*
        The exact text recorded against the submission and printed on the
        invoice — one shared constant, so what the contractor ticks and what
        the document says can never differ.
      */}
      <label className="flex items-start gap-3 rounded-xl bg-white p-4 text-sm shadow-sm">
        <input
          type="checkbox"
          checked={declarationAccepted}
          onChange={(e) => onDeclarationChange(e.target.checked)}
          className="mt-1 h-5 w-5 shrink-0"
        />
        <span>{CONTRACTOR_DECLARATION}</span>
      </label>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="flex-1 rounded-lg bg-white p-4 text-base font-semibold shadow-sm disabled:opacity-50"
        >
          Back to edit
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy || !declarationAccepted || invoiceNumberBlank}
          className="flex-1 rounded-lg p-4 text-base font-semibold text-white disabled:opacity-50"
          style={{ background: 'var(--wfr-accent)' }}
        >
          {busy ? 'Submitting…' : 'Confirm and submit'}
        </button>
      </div>

      {/*
        Always guarded: a review screen cannot be reached without entries, so
        leaving here always costs the contractor the period they just filled
        in. Nothing on this screen is persisted until Confirm succeeds.
      */}
      <PageNav hasUnsavedEntries />
    </div>
  )
}
