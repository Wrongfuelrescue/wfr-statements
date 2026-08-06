
import 'server-only'
import type { StatementTotals } from '@/lib/calc/types'
import type { RateCard } from '@/lib/rates/types'
import type { StatementMeta } from '@/lib/pdf/render'
import { airtableFetch, credentials } from './client'
import { STATEMENTS_TABLE, STATEMENT_LINES_TABLE } from './fields'
import { assertRecordId } from './recordId'

/** Airtable rejects batches larger than 10 records per create call. */
const BATCH_SIZE = 10

/**
 * The `Type` field's display text for each statement kind. Shared by
 * `createStatement` (which writes it) and `findSubmittedStatement` (which
 * matches on it) so the two can never drift apart.
 */
export function statementTypeLabel(metaType: StatementMeta['type']): string {
  return metaType === 'fortnightly' ? 'Fortnightly' : 'Monthly Bonus'
}

/**
 * Strips identity fields (ABN, address, bank details) from a rate card
 * before it is frozen into a statement's `Rate Snapshot`. The snapshot's job
 * is to stop a later pricing change in INVOICE MATRIX from retroactively
 * altering a statement that already backed a claim — identity fields are not
 * pricing, and Airtable already holds them in INVOICE MATRIX, so there is no
 * reason for a contractor's bank account and BSB to be duplicated into a
 * long-text field on every Statements row.
 */
type IdentityField = 'abn' | 'address' | 'bankAccount' | 'bankBsb'
const IDENTITY_FIELDS: readonly IdentityField[] = ['abn', 'address', 'bankAccount', 'bankBsb']

function rateSnapshot(rates: RateCard): Omit<RateCard, IdentityField> {
  const snapshot: Partial<RateCard> = { ...rates }
  for (const field of IDENTITY_FIELDS) {
    delete snapshot[field]
  }
  return snapshot as Omit<RateCard, IdentityField>
}

export async function createStatement({
  rates,
  totals,
  meta,
}: {
  rates: RateCard
  totals: StatementTotals
  meta: StatementMeta
}): Promise<{ statementId: string; lineIds: string[] }> {
  const type = statementTypeLabel(meta.type)

  // Status is deliberately omitted here and set only after every line batch
  // has succeeded (see the PATCH below). If a batch throws partway through
  // (a transient 5xx is entirely plausible), the header must not read as
  // "Submitted" while some of its lines are missing — that would let WFR
  // reconcile against silently truncated data. A blank Status is visibly
  // incomplete in the Airtable UI and is already excluded by
  // listStatementsForContractor's {Status}="Submitted" filter. Do not move
  // Status back into this initial create.
  const header = (await airtableFetch(`/${STATEMENTS_TABLE}`, {
    method: 'POST',
    body: JSON.stringify({
      fields: {
        // Primary field. Unpopulated, every linked record shows blank in the
        // Airtable UI, which makes reconciliation unusable for WFR.
        Statement: `${rates.name} — ${type} — ${meta.periodStart}`,
        Contractor: [rates.contractorId],
        // Plain-text mirror of the Contractor link's record ID. Airtable
        // formulas resolve a link field to its linked record's *primary
        // field text*, not its record ID, so filtering listStatementsForContractor
        // by ID requires this separate exact-match field rather than the link.
        'Contractor ID': rates.contractorId,
        Type: type,
        'Period Start': meta.periodStart,
        'Period End': meta.periodEnd,
        Subtotal: totals.workSubtotal,
        GST: totals.gst,
        Reimbursements: totals.reimbursements,
        Total: totals.total,
        'GST Registered At Submission': rates.gstRegistered ? 'YES' : 'NO',
        // The same instant printed as "Submitted <date>" on the PDF —
        // generated once in the route handler before the PDF is rendered,
        // not a fresh timestamp here, so the two can never disagree.
        'Submitted At': meta.submittedAt,
        // Human-quotable id (lib/reference.ts), printed on the PDF. This is
        // the only way back to this row from a PDF alone: the PDF renders
        // before this record exists, so it can never carry the record id.
        Reference: meta.reference,
        // The contractor's own number. Not printed on the invoice — this
        // record is the only place it lives, and where WFR reconciles against
        // it. Not unique across contractors: Reference identifies this row.
        'Contractor Invoice Number': meta.contractorInvoiceNumber,
        // Evidence the declaration was given. A declaration nobody can prove
        // was accepted is worth little.
        'Declaration Accepted At': meta.declarationAcceptedAt,
        // Snapshot so a later rate change cannot retroactively alter this
        // statement. Identity fields (abn, address, bankAccount, bankBsb) are
        // deliberately excluded: the snapshot exists to freeze *pricing*, and
        // identity fields play no part in that — Airtable already holds them
        // in INVOICE MATRIX. Without this exclusion, every Statements row's
        // long-text field would carry a copy of the contractor's bank account
        // and BSB for no purpose.
        'Rate Snapshot': JSON.stringify(rateSnapshot(rates)),
        // Contractor-supplied monthly free-text note (e.g. explaining an
        // otherwise-ambiguous claim). Conditionally spread so a statement
        // without one omits the field entirely rather than writing an empty
        // string over whatever (nothing) is already there.
        ...(totals.note ? { Notes: totals.note } : {}),
      },
      typecast: true,
    }),
  })) as { id: string }

  const lineRecords = totals.lines.map((line) => ({
    fields: {
      // Primary field. Dated lines get the date prefixed; dateless bonus
      // lines (monthly statements) just use the line type.
      Line: line.date ? `${line.date} ${line.lineType}` : line.lineType,
      Statement: [header.id],
      ...(line.date ? { Date: line.date } : {}),
      'Line Type': line.lineType,
      Quantity: line.quantity,
      'Unit Rate': line.unitRate,
      Amount: line.amount,
      ...(line.description ? { Description: line.description } : {}),
    },
  }))

  // Airtable returns created records in request order, so concatenating each
  // batch's ids in order gives an array aligned with totals.lines — the
  // caller relies on this to attach a receipt to the correct line.
  const lineIds: string[] = []
  for (let i = 0; i < lineRecords.length; i += BATCH_SIZE) {
    const batch = (await airtableFetch(`/${STATEMENT_LINES_TABLE}`, {
      method: 'POST',
      body: JSON.stringify({
        records: lineRecords.slice(i, i + BATCH_SIZE),
        typecast: true,
      }),
    })) as { records: Array<{ id: string }> }
    lineIds.push(...batch.records.map((r) => r.id))
  }

  // All lines are written — only now mark the statement complete.
  await airtableFetch(`/${STATEMENTS_TABLE}/${header.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      fields: { Status: 'Submitted' },
      typecast: true,
    }),
  })

  return { statementId: header.id, lineIds }
}

export async function attachPdfToStatement(
  statementId: string,
  filename: string,
  pdf: Buffer,
): Promise<void> {
  assertRecordId(statementId)
  const { token, baseId } = credentials()

  const response = await fetch(
    `https://content.airtable.com/v0/${baseId}/${statementId}/PDF/uploadAttachment`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contentType: 'application/pdf',
        file: pdf.toString('base64'),
        filename,
      }),
    },
  )

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`PDF upload failed (${response.status}): ${body}`)
  }
}

export async function attachReceiptToLine(
  lineId: string,
  filename: string,
  contentType: string,
  base64: string,
): Promise<void> {
  assertRecordId(lineId)
  const { token, baseId } = credentials()

  const response = await fetch(
    `https://content.airtable.com/v0/${baseId}/${lineId}/Receipt/uploadAttachment`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contentType,
        file: base64,
        filename,
      }),
    },
  )

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Receipt upload failed (${response.status}): ${body}`)
  }
}

/**
 * Best-effort write. This is called from paths that have already succeeded
 * and returned a result to the contractor (e.g. after a PDF attach or a
 * receipt upload fails) — a failure to record the warning itself must never
 * throw and take down an otherwise-successful request. It is logged instead.
 */
export async function recordStatementWarning(
  statementId: string,
  warning: string,
): Promise<void> {
  try {
    assertRecordId(statementId)
    await airtableFetch(`/${STATEMENTS_TABLE}/${statementId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        fields: { Warnings: warning },
        typecast: true,
      }),
    })
  } catch (error) {
    console.error(`Failed to record warning on statement ${statementId}:`, error)
  }
}

export async function listStatementsForContractor(contractorId: string): Promise<
  Array<{
    id: string
    type: string
    periodStart: string
    periodEnd: string
    total: number
    submittedAt: string
    reference: string
    /**
     * The contractor's own invoice number, as printed on the PDF. Shown on
     * "My submissions" so the screen and the document agree on how a
     * statement is named. Empty on rows submitted before the number was
     * collected, which is why the page falls back to `reference`.
     */
    contractorInvoiceNumber: string
    /**
     * The stored PDF's download URL, or `null` when the attachment is
     * missing — the statement is still Status="Submitted" (see
     * createStatement: Status is set before the PDF attach is attempted in
     * the route handler), so it appears in this list, but
     * `attachPdfToStatement` failed and left a Warnings note instead. A
     * contractor's "My submissions" page must render this gracefully rather
     * than as a broken link.
     */
    pdfUrl: string | null
  }>
> {
  assertRecordId(contractorId)
  // Exact match against the plain-text Contractor ID field, not the
  // Contractor link — Airtable formulas resolve a link field to its linked
  // record's primary field text (the contractor's Name), not its record ID,
  // so matching on the link would never find the right rows (or could match
  // the wrong contractor if an ID substring ever appeared in a name).
  const formula = encodeURIComponent(
    `AND({Contractor ID}="${contractorId}", {Status}="Submitted")`,
  )
  const data = (await airtableFetch(
    `/${STATEMENTS_TABLE}?filterByFormula=${formula}&pageSize=50`,
  )) as { records: Array<{ id: string; fields: Record<string, unknown> }> }

  return data.records
    .map((r) => {
      const attachments = r.fields.PDF
      const firstAttachment =
        Array.isArray(attachments) && attachments.length > 0
          ? (attachments[0] as { url?: unknown })
          : null
      const pdfUrl =
        firstAttachment && typeof firstAttachment.url === 'string' ? firstAttachment.url : null

      return {
        id: r.id,
        type: String(r.fields.Type ?? ''),
        periodStart: String(r.fields['Period Start'] ?? ''),
        periodEnd: String(r.fields['Period End'] ?? ''),
        total: Number(r.fields.Total ?? 0),
        submittedAt: String(r.fields['Submitted At'] ?? ''),
        reference: String(r.fields.Reference ?? ''),
        contractorInvoiceNumber: String(r.fields['Contractor Invoice Number'] ?? ''),
        pdfUrl,
      }
    })
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
}

/**
 * Looks up an already-Submitted statement for the same contractor, type, and
 * period start. Called by the statements route before `createStatement` so a
 * contractor who presses Review → Confirm twice (the common path when the
 * only success signal is a browser download that mobile Safari often
 * swallows silently) is rejected with a 409 instead of creating a second
 * paid claim. `periodStart` must already be validated as a `yyyy-mm-dd`
 * string by the caller before it reaches this formula.
 */
export async function findSubmittedStatement(
  contractorId: string,
  type: string,
  periodStart: string,
): Promise<{ id: string } | null> {
  assertRecordId(contractorId)
  // Why DATESTR() is required: `Period Start` is an Airtable Date field, not
  // text. Comparing a Date field directly to a string literal
  // (`{Period Start}="2026-07-21"`) is not reliable Airtable formula
  // semantics — this project has already been bitten once by a closely
  // related class of bug (see "Why `Contractor ID` exists" above, where a
  // link field silently resolved to its primary-field text rather than a
  // record ID). This clause is the entire duplicate-submission guard: if it
  // silently matches nothing, a contractor who submits twice creates a
  // second full Submitted statement and a second paid claim. DATESTR()
  // coerces the Date field to an unambiguous ISO string so the comparison is
  // exact. Do not simplify this back to a bare string comparison.
  const formula = encodeURIComponent(
    `AND({Contractor ID}="${contractorId}", {Type}="${type}", ` +
      `DATESTR({Period Start})="${periodStart}", {Status}="Submitted")`,
  )
  const data = (await airtableFetch(
    `/${STATEMENTS_TABLE}?filterByFormula=${formula}&pageSize=1&maxRecords=1`,
  )) as { records: Array<{ id: string }> }

  return data.records[0] ? { id: data.records[0].id } : null
}
