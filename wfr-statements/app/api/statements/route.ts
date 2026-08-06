import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getRateCard } from '@/lib/airtable/contractors'
import {
  attachPdfToStatement,
  attachReceiptToLine,
  createStatement,
  findSubmittedStatement,
  recordStatementWarning,
  statementTypeLabel,
} from '@/lib/airtable/statements'
import { calculateFortnightly } from '@/lib/calc/fortnightly'
import { calculateMonthly } from '@/lib/calc/monthly'
import type { BonusEntry, DayEntry, Reimbursement, StatementTotals } from '@/lib/calc/types'
import { fortnightStartFromEnd, monthRange } from '@/lib/dates'
import { readSessionToken, SESSION_COOKIE } from '@/lib/auth/session'
import { renderStatementPdf, type StatementMeta } from '@/lib/pdf/render'
import { validateDeclaration } from '@/lib/invoice/declaration'
import { validateInvoiceNumber } from '@/lib/invoice/invoiceNumber'
import { generateStatementReference } from '@/lib/reference'
import { RateParseError } from '@/lib/rates/parse'
import type { RateCard } from '@/lib/rates/types'
import type { Receipt } from '@/lib/receipts/types'
import {
  validateFortnightlyDays,
  validateMonth,
  validatePeriodEnd,
  validateReimbursement,
} from '@/lib/validation/statementRequest'

type Body =
  | {
      type: 'fortnightly'
      periodEnd: string
      days: DayEntry[]
      reimbursement?: Reimbursement
      receipt?: Receipt
      contractorInvoiceNumber?: string
      declarationAccepted?: unknown
    }
  | {
      type: 'monthly'
      month: string
      bonus: BonusEntry
      contractorInvoiceNumber?: string
      declarationAccepted?: unknown
    }

/**
 * Server-side cap on a receipt's raw decoded size — never trust the client's
 * downscaling. Deliberately looser than downscale.ts's client-side
 * MAX_RECEIPT_BYTES (1 MB, post-downscale): this one is a backstop against a
 * malicious or buggy client sending an undownscaled file, not the primary
 * size control.
 */
const MAX_RECEIPT_BYTES_SERVER = 2 * 1024 * 1024

/**
 * `body` is parsed straight from `request.json()` — entirely client
 * controlled, with no runtime guarantee behind the `Body` type. A receipt
 * that is null, missing a field, or has a field of the wrong type must be
 * rejected before any property on it is touched, the same way an oversized
 * or non-image receipt is rejected: as a warning, never a thrown error. This
 * check runs after the statement is already persisted and Submitted — an
 * uncaught throw here would surface as a failed submission for a statement
 * that actually went through.
 */
function isWellFormedReceipt(value: unknown): value is Receipt {
  if (typeof value !== 'object' || value === null) return false
  const r = value as Record<string, unknown>
  return (
    typeof r.filename === 'string' &&
    typeof r.contentType === 'string' &&
    typeof r.data === 'string'
  )
}

/**
 * Deliberately generic. The underlying error may carry an Airtable response
 * body, a stack trace, or another internal detail that must never reach the
 * browser — so it is logged server-side and never included in the response.
 */
const SUBMISSION_FAILED =
  'Something went wrong submitting your statement. Please try again, or contact WFR accounts if the problem continues.'

export async function POST(request: Request) {
  const store = await cookies()
  // Always trust the session, never a contractor id in the request body —
  // otherwise any signed-in contractor could submit a statement priced at
  // someone else's rates.
  const contractorId = await readSessionToken(store.get(SESSION_COOKIE)?.value)
  if (!contractorId) {
    return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  }

  const body = (await request.json()) as Body

  // Rates are resolved fresh per request and snapshotted onto the statement
  // below — never trust anything the client says about pricing.
  let rates: RateCard
  try {
    rates = await getRateCard(contractorId)
  } catch (error) {
    if (error instanceof RateParseError) {
      // Malformed rate data in Airtable — a real problem, but one whose
      // message is safe and actionable for the contractor to relay.
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Failed to load rate card for statement submission:', error)
    return NextResponse.json({ error: SUBMISSION_FAILED }, { status: 500 })
  }

  let totals: StatementTotals
  let meta: StatementMeta

  // calculateFortnightly/calculateMonthly are pure functions over the raw
  // submitted entries — never over any client-computed total. Any error they
  // throw (an unentitled claim, negative hours, an incomplete reimbursement)
  // is a deliberate validation failure, not an infrastructure fault, so it
  // is always safe to report back to the contractor as a 400.
  // Generated once, before the PDF is rendered, so the reference printed on
  // the PDF and the "Submitted <date>" instant next to it are the exact same
  // values later written to the Airtable record — never a second, slightly
  // later timestamp computed at persist time.
  const reference = generateStatementReference()
  const submittedAt = new Date().toISOString()

  try {
    // Checked here, inside the try, so a blank or unprintable number returns
    // a 400 carrying the readable message exactly like every other
    // validation failure — the client blocks it too, but never trust that.
    const contractorInvoiceNumber = validateInvoiceNumber(body.contractorInvoiceNumber)
    // Strictly `true`. Rejected here, before createStatement, so a refused
    // declaration can never leave an orphan Submitted statement behind.
    validateDeclaration(body.declarationAccepted)

    if (body.type === 'fortnightly') {
      const periodEnd = validatePeriodEnd(body.periodEnd)
      const periodStart = fortnightStartFromEnd(periodEnd)
      const days = body.days ?? []
      const reimbursement = validateReimbursement(body.reimbursement)
      validateFortnightlyDays(days, periodStart)
      totals = calculateFortnightly(days, reimbursement, rates)
      meta = {
        type: 'fortnightly',
        periodStart,
        periodEnd,
        reference,
        submittedAt,
        contractorInvoiceNumber,
        // The one instant generated above, reused — never a fresh Date, or
        // the acceptance and the invoice date could disagree.
        declarationAcceptedAt: submittedAt,
      }
    } else if (body.type === 'monthly') {
      const month = validateMonth(body.month)
      totals = calculateMonthly(body.bonus, rates)
      const { start, end } = monthRange(month)
      meta = {
        type: 'monthly',
        periodStart: start,
        periodEnd: end,
        reference,
        submittedAt,
        contractorInvoiceNumber,
        // The one instant generated above, reused — never a fresh Date, or
        // the acceptance and the invoice date could disagree.
        declarationAcceptedAt: submittedAt,
      }
    } else {
      return NextResponse.json({ error: 'Unknown statement type.' }, { status: 400 })
    }
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    throw error
  }

  if (totals.total <= 0) {
    return NextResponse.json(
      { error: 'There is nothing to claim on this statement.' },
      { status: 400 },
    )
  }

  // A contractor whose only success signal is a browser download (frequently
  // silent or hard to find on mobile Safari) will often press Review →
  // Confirm a second time. Nothing has been persisted yet at this point, so
  // it is always safe to reject here rather than create a second Submitted
  // statement — a second full set of Statement Lines and a duplicate paid
  // claim WFR would have no way to tell apart from the first.
  try {
    const existing = await findSubmittedStatement(
      contractorId,
      statementTypeLabel(meta.type),
      meta.periodStart,
    )
    if (existing) {
      return NextResponse.json(
        {
          error:
            'A statement for this period has already been submitted. Check "My submissions" — ' +
            'if it needs changing, contact WFR accounts.',
        },
        { status: 409 },
      )
    }
  } catch (error) {
    console.error('Failed to check for a duplicate statement submission:', error)
    return NextResponse.json({ error: SUBMISSION_FAILED }, { status: 500 })
  }

  let pdf: Buffer
  try {
    pdf = await renderStatementPdf(totals, rates, meta)
  } catch (error) {
    // Nothing has been persisted yet, so it is safe for the contractor to retry.
    console.error('Failed to render statement PDF:', error)
    return NextResponse.json({ error: SUBMISSION_FAILED }, { status: 500 })
  }

  // The reference is included so a contractor's own downloaded copy is
  // traceable back to the Airtable record by filename alone.
  const filename =
    `Invoice-${rates.name.replace(/\s+/g, '-')}-${meta.periodStart}-${meta.reference}.pdf`

  let statementId: string
  let lineIds: string[]
  try {
    ;({ statementId, lineIds } = await createStatement({ rates, totals, meta }))
  } catch (error) {
    // createStatement only marks a statement Submitted after every line row
    // has been written; a failure here leaves either nothing or an
    // incomplete, blank-Status record that is already excluded from every
    // listing. Either way it is safe to report the failure and let the
    // contractor retry without risking a duplicate paid claim.
    console.error('Failed to persist statement to Airtable:', error)
    return NextResponse.json({ error: SUBMISSION_FAILED }, { status: 500 })
  }

  // From here on the statement is fully persisted and marked Submitted — the
  // record WFR reconciles pay against. Nothing below may fail the request:
  // that would tell the contractor their submission didn't go through and
  // invite a resubmit, which would create a second Submitted statement and
  // double their claim. Failures are logged and accumulated as warnings on
  // the statement instead, written in a single PATCH at the end.
  const warnings: string[] = []

  // An invoice with no supplier ABN obliges the payer to withhold 47% of the
  // payment under the no-ABN withholding rule — regardless of whether the
  // contractor is GST-registered — so this warning applies to every
  // contractor with a blank ABN, not just registered ones. A GST-registered
  // contractor's invoice loses WFR a GST credit as well, which a
  // non-registered contractor's does not, so only that half of the wording
  // varies. Only WFR can fix this (the ABN lives in INVOICE MATRIX, not
  // anything the contractor controls), so this is a warning on the
  // statement record, not a rejection.
  if (rates.abn.trim() === '') {
    const gstClause = rates.gstRegistered
      ? 'this tax invoice is not valid for WFR to claim a GST credit against, and '
      : ''
    warnings.push(
      `Contractor has no ABN on file, so ${gstClause}WFR is obliged to withhold ` +
        '47% of this payment. Add their ABN to INVOICE MATRIX and ask them to resubmit.',
    )
  }

  try {
    await attachPdfToStatement(statementId, filename, pdf)
  } catch (error) {
    console.error(`Failed to attach PDF to statement ${statementId}:`, error)
    const message = error instanceof Error ? error.message : String(error)
    warnings.push(`PDF failed to attach: ${message}`)
  }

  const rawReceipt = body.type === 'fortnightly' ? body.receipt : undefined
  if (rawReceipt !== undefined) {
    // Wrapped so a malformed or unexpectedly-shaped receipt can never abort
    // the request — the statement above is already persisted and Submitted.
    try {
      if (!isWellFormedReceipt(rawReceipt)) {
        warnings.push('Receipt was rejected: malformed receipt payload.')
      } else {
        const receipt = rawReceipt
        const lineIndex = totals.lines.findIndex((line) => line.lineType === 'Reimbursement')

        if (lineIndex === -1) {
          warnings.push('Receipt: no matching reimbursement line was found.')
        } else if (!receipt.contentType.startsWith('image/')) {
          warnings.push(`Receipt was rejected: not an image (${receipt.contentType}).`)
        } else if (Buffer.byteLength(receipt.data, 'base64') > MAX_RECEIPT_BYTES_SERVER) {
          warnings.push('Receipt was rejected: file too large after decoding.')
        } else {
          await attachReceiptToLine(
            lineIds[lineIndex],
            receipt.filename,
            receipt.contentType,
            receipt.data,
          )
        }
      }
    } catch (error) {
      console.error(`Failed to process receipt on statement ${statementId}:`, error)
      const message = error instanceof Error ? error.message : String(error)
      warnings.push(`Receipt failed to attach: ${message}`)
    }
  }

  if (warnings.length > 0) {
    await recordStatementWarning(statementId, warnings.join('\n'))
  }

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      // Lets the client build its own download filename (it sets `link.download`
      // explicitly, which overrides Content-Disposition's suggested name)
      // while still including the reference — never sensitive, safe to expose.
      'X-Statement-Reference': meta.reference,
    },
  })
}
