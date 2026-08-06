'use client'

import { useEffect, useMemo, useState } from 'react'
import { calculateMonthly } from '@/lib/calc/monthly'
import type { BonusEntry } from '@/lib/calc/types'
import type { RateCard } from '@/lib/rates/types'
import { PageNav } from '@/components/PageNav'
import { SessionHeartbeat } from '@/components/SessionHeartbeat'
import { RunningTotal } from '@/components/RunningTotal'
import { StatementReview } from '@/components/StatementReview'
import { SubmissionSuccess } from '@/components/SubmissionSuccess'
import { formatDisplayDateWithYear, monthRange } from '@/lib/dates'
import { suggestInvoiceNumber } from '@/lib/invoice/invoiceNumber'
import {
  FUEL_FILTER_SALE_PRICE_30,
  FUEL_FILTER_SALE_PRICE_70,
  formatSalePrice,
} from '@/lib/invoice/bonusSalePrices'

export function MonthlyForm({
  rates,
  defaultMonth,
}: {
  rates: RateCard
  defaultMonth: string
}) {
  const [month, setMonth] = useState(defaultMonth)
  // Derived from the selected month until the contractor edits it, then
  // theirs for good — see FortnightlyForm for why both halves matter. A
  // month ending on a Sunday shares its last day with a fortnight, so a
  // number seeded once could collide across the two statement types too.
  const [typedInvoiceNumber, setTypedInvoiceNumber] = useState<string | null>(null)
  // Always false on mount: a declaration is only worth something if this
  // contractor gave it deliberately for this submission, so it is never
  // persisted and never pre-ticked.
  const [declarationAccepted, setDeclarationAccepted] = useState(false)
  const [bonus, setBonus] = useState<BonusEntry>({
    googleReviews: 0,
    fuelFilter30: 0,
    fuelFilter70: 0,
    note: '',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  // Held so the success screen can offer the PDF again without a second
  // submission, and released only when this form goes away.
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfFilename, setPdfFilename] = useState('')

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    }
  }, [pdfUrl])

  const totals = useMemo(() => {
    try {
      return calculateMonthly(bonus, rates)
    } catch {
      // Belt-and-braces: the count inputs below clamp every entry route
      // (typing, pasting, spinner arrows, NaN from a non-numeric paste) to a
      // non-negative integer via Math.max(0, Math.floor(...)), so
      // calculateMonthly should never actually throw. This fallback exists
      // only to keep the page from crashing if that ever changes.
      return calculateMonthly(
        { googleReviews: 0, fuelFilter30: 0, fuelFilter70: 0, note: '' },
        rates,
      )
    }
  }, [bonus, rates])

  // The label names the *sale price* that earns the bonus; the amount in
  // parentheses is the bonus itself, from the contractor's rate card. Before
  // this, both read "$30"/"$70" and gave the contractor no way to tell which
  // row a given sale belonged in.
  const counts: Array<{ key: keyof BonusEntry; label: string; rate: number }> = [
    { key: 'googleReviews', label: 'Google reviews received', rate: rates.googleReviewBonus },
    {
      key: 'fuelFilter30',
      label: `Fuel filter sales at ${formatSalePrice(FUEL_FILTER_SALE_PRICE_30)}`,
      rate: rates.fuelFilter30,
    },
    {
      key: 'fuelFilter70',
      label: `Fuel filter sales at ${formatSalePrice(FUEL_FILTER_SALE_PRICE_70)}`,
      rate: rates.fuelFilter70,
    },
  ]

  // What the contractor would lose by following the home link, which discards
  // all of this state without touching the server. The note counts: it is
  // free text nobody else can reconstruct.
  const hasUnsavedEntries =
    bonus.googleReviews > 0 ||
    bonus.fuelFilter30 > 0 ||
    bonus.fuelFilter70 > 0 ||
    bonus.note.trim() !== ''

  async function submit() {
    setError('')
    setBusy(true)
    try {
      const response = await fetch('/api/statements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'monthly',
          month,
          bonus,
          contractorInvoiceNumber: invoiceNumber,
          declarationAccepted,
        }),
      })

      if (!response.ok) {
        // A platform-level rejection never reaches the route handler and
        // never carries a JSON body — response.json() below would throw.
        // That is a genuinely unwinnable request, not a transient network
        // fault, so it must not fall into the generic catch block's "try
        // submitting again" advice. See FortnightlyForm for the same guard.
        if (response.status === 413) {
          setError('That submission was too large to send. Please contact WFR accounts.')
          return
        }

        // An idle session expired mid-form. See FortnightlyForm for why the
        // route's "Please sign in again." is not enough on its own: the
        // entries are still here, and the shared cookie makes signing in
        // elsewhere and pressing Confirm again a real recovery.
        if (response.status === 401) {
          setError(
            'You were signed out after 10 minutes without activity. Nothing is lost — ' +
              'your entries are still on this page. Sign in again in another tab, come ' +
              'back here and press Confirm again.',
          )
          return
        }

        try {
          const body = (await response.json()) as { error?: string }
          setError(body.error ?? 'Could not submit your statement.')
        } catch {
          setError(
            'Something went wrong submitting your statement. Please try again in a moment, ' +
              'or contact WFR accounts if it continues.',
          )
        }
        return
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      // See FortnightlyForm for why the reference is appended explicitly
      // rather than relying on Content-Disposition.
      const reference = response.headers?.get('X-Statement-Reference')
      const suffix = reference ? `-${reference}` : ''
      const filename = `Invoice-${rates.name.replace(/\s+/g, '-')}-${month}${suffix}.pdf`

      // No programmatic download — the contractor taps the link on the
      // success screen instead. See FortnightlyForm for why: iOS Safari
      // ignores `download` on a blob: URL and navigates the tab to the PDF,
      // which tore the app out from under a contractor on a phone.
      setPdfUrl(url)
      setPdfFilename(filename)
      setSubmitted(true)
    } catch {
      setError('Network problem — your entries are still here. Try submitting again.')
    } finally {
      setBusy(false)
    }
  }

  const { start, end } = monthRange(month)
  // Declared here because it needs the month's last day. `submit` above
  // closes over it, which is safe: it can only run after this render.
  const invoiceNumber = typedInvoiceNumber ?? suggestInvoiceNumber(end)
  const periodLabel =`${formatDisplayDateWithYear(start)} – ${formatDisplayDateWithYear(end)}`

  // The heartbeat mounts in every view: a contractor can sit on the review
  // screen re-reading their month for longer than the idle timeout.
  if (submitted) {
    return (
      <>
        <SessionHeartbeat />
        <SubmissionSuccess
          totals={totals}
          periodLabel={periodLabel}
          pdfUrl={pdfUrl}
          pdfFilename={pdfFilename}
        />
      </>
    )
  }

  if (reviewing) {
    return (
      <>
        <SessionHeartbeat />
        <StatementReview
          totals={totals}
          periodLabel={periodLabel}
          invoiceNumber={invoiceNumber}
          onInvoiceNumberChange={setTypedInvoiceNumber}
          declarationAccepted={declarationAccepted}
          onDeclarationChange={setDeclarationAccepted}
          busy={busy}
          error={error}
          onBack={() => setReviewing(false)}
          onConfirm={submit}
        />
      </>
    )
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <SessionHeartbeat />
      <label className="flex flex-col gap-1 rounded-xl bg-white p-4 text-sm font-medium shadow-sm">
        Month
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg border border-gray-300 p-3 text-base"
        />
      </label>

      <div className="flex flex-col gap-2">
        {counts.map(({ key, label, rate }) => (
          <label
            key={key}
            className="flex flex-col gap-1 rounded-xl bg-white p-4 text-sm font-medium shadow-sm"
          >
            {label} (${rate.toFixed(2)} each)
            <input
              type="number"
              min={0}
              step={1}
              value={(bonus[key] as number) || ''}
              onChange={(e) =>
                setBonus({ ...bonus, [key]: Math.max(0, Math.floor(Number(e.target.value) || 0)) })
              }
              className="rounded-lg border border-gray-300 p-3 text-base"
            />
          </label>
        ))}

        <label className="flex flex-col gap-1 rounded-xl bg-white p-4 text-sm font-medium shadow-sm">
          Note (optional)
          <textarea
            value={bonus.note}
            onChange={(e) => setBonus({ ...bonus, note: e.target.value })}
            rows={3}
            className="rounded-lg border border-gray-300 p-3 text-base"
          />
        </label>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-lg p-3 text-sm"
          style={{ background: 'var(--wfr-error-bg)', color: 'var(--wfr-error)' }}
        >
          {error}
        </p>
      ) : null}

      <RunningTotal totals={totals} />

      <button
        type="button"
        onClick={() => setReviewing(true)}
        disabled={totals.total <= 0}
        className="rounded-lg p-4 text-base font-semibold text-white disabled:opacity-50"
        style={{ background: 'var(--wfr-accent)' }}
      >
        Review statement
      </button>

      <PageNav hasUnsavedEntries={hasUnsavedEntries} />
    </div>
  )
}
