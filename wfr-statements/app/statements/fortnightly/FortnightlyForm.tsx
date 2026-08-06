'use client'

import { useEffect, useMemo, useState } from 'react'
import { calculateFortnightly } from '@/lib/calc/fortnightly'
import type { DayEntry, Reimbursement } from '@/lib/calc/types'
import {
  fortnightDatesEndingOn,
  fortnightStartFromEnd,
  formatDisplayDate,
  formatDisplayDateWithYear,
} from '@/lib/dates'
import { suggestInvoiceNumber } from '@/lib/invoice/invoiceNumber'
import type { RateCard } from '@/lib/rates/types'
import {
  MAX_TOTAL_RECEIPTS_BYTES,
  processReceiptFile,
  ReceiptError,
  totalReceiptsBytes,
} from '@/lib/receipts/downscale'
import type { Receipt } from '@/lib/receipts/types'
import { DayCard } from '@/components/DayCard'
import { PageNav } from '@/components/PageNav'
import { ReimbursementSection } from '@/components/ReimbursementSection'
import { RunningTotal } from '@/components/RunningTotal'
import { SessionHeartbeat } from '@/components/SessionHeartbeat'
import { StatementReview } from '@/components/StatementReview'
import { SubmissionSuccess } from '@/components/SubmissionSuccess'

const NO_REIMBURSEMENT: Reimbursement = { amount: 0, description: '' }

function blankDay(date: string): DayEntry {
  return {
    date,
    shift: 'none',
    adjustedHours: 0,
    additionalLabourHours: 0,
    service: 'none',
  }
}

function blankDays(end: string): DayEntry[] {
  return fortnightDatesEndingOn(end).map(blankDay)
}

function hasEntry(day: DayEntry): boolean {
  return day.shift !== 'none' || day.additionalLabourHours > 0 || day.service !== 'none'
}

export function FortnightlyForm({
  rates,
  defaultEnd,
}: {
  rates: RateCard
  defaultEnd: string
}) {
  const [end, setEnd] = useState(defaultEnd)
  // Two rules, and both matter. Until the contractor edits the field, the
  // number is *derived* from the selected period, so changing the fortnight
  // changes the suggestion with it — seeding it once meant a contractor
  // catching up on two fortnights in one sitting issued two tax invoices
  // bearing the same number, breaking their sequence and WFR's reconciliation.
  // Once they have edited it, `typedInvoiceNumber` wins for good and no
  // period change can overwrite what they chose.
  const [typedInvoiceNumber, setTypedInvoiceNumber] = useState<string | null>(null)
  const invoiceNumber = typedInvoiceNumber ?? suggestInvoiceNumber(end)
  // Always false on mount: a declaration is only worth something if this
  // contractor gave it deliberately for this submission, so it is never
  // persisted and never pre-ticked.
  const [declarationAccepted, setDeclarationAccepted] = useState(false)
  const [days, setDays] = useState<DayEntry[]>(() => blankDays(defaultEnd))
  const [reimbursement, setReimbursement] = useState<Reimbursement>(NO_REIMBURSEMENT)
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [receiptError, setReceiptError] = useState('')
  const [receiptProcessing, setReceiptProcessing] = useState(false)
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

  // What the contractor would lose by following the home link, which
  // discards all of this state without touching the server. Deliberately
  // broader than what makes Review possible: a half-entered reimbursement or
  // an attached receipt photo is work too, and re-taking a photo of a receipt
  // is exactly the sort of thing a contractor cannot redo later.
  const hasUnsavedEntries =
    days.some(hasEntry) ||
    reimbursement.amount > 0 ||
    reimbursement.description.trim() !== '' ||
    receipt !== null

  // A reimbursement amount typed before its description is mid-entry, not
  // invalid — but it must block Review rather than silently drop from the
  // total the contractor is about to confirm, or reach the server, which
  // rejects the whole submission with a 400 the review screen gave no way to
  // anticipate.
  const incompleteReimbursement =
    reimbursement.amount > 0 && reimbursement.description.trim() === ''

  // While incomplete, treat it as absent for display purposes only — a single
  // condition on a single input, checked right here, is all that's needed
  // now the reimbursement lives at the foot of the form rather than on every
  // day.
  const displayReimbursement: Reimbursement = incompleteReimbursement
    ? NO_REIMBURSEMENT
    : reimbursement

  // Choosing "Adjusted shift" without yet entering hours is mid-entry, not
  // invalid — calculateFortnightly throws for it (adjustedHours <= 0), and
  // without this guard the useMemo below caught that and fell back to an
  // *empty* calculation, dropping the running total for the whole fortnight
  // to $0.00 rather than just the one day still being filled in. Mirrors
  // incompleteReimbursement above: excluded from the display calculation,
  // not the whole fortnight, and named in an alert rather than left silent.
  const incompleteAdjustedDays = days.filter(
    (d) => d.shift === 'adjusted' && d.adjustedHours <= 0,
  )
  const hasIncompleteAdjusted = incompleteAdjustedDays.length > 0

  const displayDays = hasIncompleteAdjusted
    ? days.map((d) =>
        d.shift === 'adjusted' && d.adjustedHours <= 0 ? { ...d, shift: 'none' as const } : d,
      )
    : days

  const totals = useMemo(() => {
    try {
      return calculateFortnightly(displayDays, displayReimbursement, rates)
    } catch {
      // Belt-and-braces: any other unexpected invalid state still falls back
      // to zero rather than crashing the page. Negative values can no longer
      // reach state via DayCard's or this form's inputs, so this should be
      // unreachable in normal use.
      return calculateFortnightly([], NO_REIMBURSEMENT, rates)
    }
  }, [displayDays, displayReimbursement, rates])

  function changeEnd(next: string) {
    const byDate = new Map(days.map((d) => [d.date, d]))
    const carried = fortnightDatesEndingOn(next).map((date) => byDate.get(date) ?? blankDay(date))

    const carriedDates = new Set(carried.map((d) => d.date))
    const dropped = days.filter((d) => hasEntry(d) && !carriedDates.has(d.date))

    if (dropped.length > 0) {
      const ok = window.confirm(
        `Changing the period will discard work you entered on ${dropped.length} ` +
          `day${dropped.length === 1 ? '' : 's'} outside the new fortnight. Continue?`,
      )
      if (!ok) return
    }

    setEnd(next)
    setDays(carried)
  }

  function handleReimbursementChange(next: Reimbursement) {
    setReimbursement(next)
    if (next.amount === 0) {
      setReceipt(null)
      setReceiptError('')
    }
  }

  async function handleReceiptFileChange(file: File | null) {
    if (!file) return

    setReceiptError('')
    setReceiptProcessing(true)
    try {
      const processed = await processReceiptFile(file)
      setReceipt(processed)
    } catch (error) {
      setReceiptError(
        error instanceof ReceiptError
          ? error.message
          : 'Could not process this photo. Try a different one.',
      )
    } finally {
      setReceiptProcessing(false)
    }
  }

  async function submit() {
    setError('')

    // Sent before the platform ever sees the request: a receipt payload over
    // the body-size limit is rejected pre-route with a non-JSON body, which
    // otherwise surfaces as an unwinnable "Network problem, try again" loop.
    // Catching it here, client-side, turns that into an actionable message.
    const receiptBytes = totalReceiptsBytes(receipt ?? undefined)
    if (receiptBytes > MAX_TOTAL_RECEIPTS_BYTES) {
      setError(
        `Your receipt photo is ${(receiptBytes / (1024 * 1024)).toFixed(1)} MB, which is too ` +
          'large to submit. Remove it and try again.',
      )
      return
    }

    setBusy(true)
    try {
      const response = await fetch('/api/statements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'fortnightly',
          periodEnd: end,
          days,
          reimbursement,
          receipt: receipt ?? undefined,
          contractorInvoiceNumber: invoiceNumber,
          declarationAccepted,
        }),
      })

      if (!response.ok) {
        // A platform-level rejection (e.g. the body exceeded the request-size
        // limit) never reaches the route handler and never carries a JSON
        // body — response.json() below would throw. That is a genuinely
        // unwinnable request, not a transient network fault, so it must not
        // fall into the generic catch block's "try submitting again" advice.
        if (response.status === 413) {
          setError(
            'That submission was too large to send — most likely the receipt photo. ' +
              'Remove it and try again.',
          )
          return
        }

        // The session is a 10-minute idle timeout, and filling in a
        // fortnight is easily interrupted for longer than that. The route's
        // own "Please sign in again." is true but useless here: it neither
        // says the fourteen days are still on the screen (they are — nothing
        // below this point ran) nor names the one recovery that works. The
        // cookie is shared across tabs, so signing in elsewhere and pressing
        // Confirm again submits exactly what is already entered.
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
      // The reference (if the response carried one) makes a contractor's own
      // downloaded copy traceable back to the Airtable record by filename
      // alone — link.download overrides the server's suggested filename, so
      // it must be included here explicitly rather than relying on
      // Content-Disposition.
      const reference = response.headers?.get('X-Statement-Reference')
      const suffix = reference ? `-${reference}` : ''
      const filename = `Invoice-${rates.name.replace(/\s+/g, '-')}-${end}${suffix}.pdf`

      // The app deliberately does NOT trigger the download itself.
      //
      // It used to synthesise an <a download> and click it. iOS Safari
      // ignores `download` on a blob: URL and *navigates the tab* to the PDF
      // instead, which destroys the page — so the contractor ended up staring
      // at their invoice with the app gone from underneath them. Setting the
      // success state before the click (an earlier attempt at this) cannot
      // help: navigation tears down the document, so there is no React state
      // left to have set.
      //
      // Instead the success screen renders a real link the contractor taps
      // themselves, opening in a new tab. Nothing navigates this tab, so the
      // app is still here when they come back. The URL is revoked on unmount
      // rather than now — see the effect above — so the link keeps working
      // for as long as the screen is on display.
      setPdfUrl(url)
      setPdfFilename(filename)
      setSubmitted(true)
    } catch {
      setError('Network problem — your entries are still here. Try submitting again.')
    } finally {
      setBusy(false)
    }
  }

  const start = fortnightStartFromEnd(end)
  const periodLabel = `${formatDisplayDateWithYear(start)} – ${formatDisplayDateWithYear(end)}`

  // The heartbeat mounts in every view: a contractor can sit on the review
  // screen re-reading their fortnight for longer than the idle timeout.
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
        Fortnight ending
        <input
          type="date"
          value={end}
          onChange={(e) => changeEnd(e.target.value)}
          className="rounded-lg border border-gray-300 p-3 text-base"
        />
        <span className="text-xs font-normal" style={{ color: 'var(--wfr-text-muted)' }}>
          {periodLabel}. Defaults to the most recent Sunday — WFR&apos;s fortnights run to a
          Sunday pay cycle. Change it if you need a different period.
        </span>
      </label>

      <div className="flex flex-col gap-2">
        {days.map((day, index) => (
          <DayCard
            key={day.date}
            entry={day}
            rates={rates}
            onChange={(next) => setDays(days.map((d, i) => (i === index ? next : d)))}
          />
        ))}
      </div>

      <ReimbursementSection
        value={reimbursement}
        onChange={handleReimbursementChange}
        receipt={receipt}
        onReceiptChange={handleReceiptFileChange}
      />

      {hasIncompleteAdjusted ? (
        <p
          role="alert"
          className="rounded-lg p-3 text-sm"
          style={{ background: 'var(--wfr-warning-bg)', color: 'var(--wfr-warning)' }}
        >
          {`Enter the hours worked for the adjusted shift on ` +
            incompleteAdjustedDays.map((d) => formatDisplayDate(d.date)).join(', ') +
            ' before you submit.'}
        </p>
      ) : null}

      {receiptError ? (
        <p role="alert" className="text-xs font-normal" style={{ color: 'var(--wfr-error)' }}>
          {receiptError}
        </p>
      ) : null}

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

      {receiptProcessing ? (
        <p className="text-sm" style={{ color: 'var(--wfr-text-muted)' }}>
          Processing receipt photo…
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => setReviewing(true)}
        disabled={
          totals.total <= 0 || receiptProcessing || incompleteReimbursement || hasIncompleteAdjusted
        }
        className="rounded-lg p-4 text-base font-semibold text-white disabled:opacity-50"
        style={{ background: 'var(--wfr-accent)' }}
      >
        Review statement
      </button>

      <PageNav hasUnsavedEntries={hasUnsavedEntries} />
    </div>
  )
}
