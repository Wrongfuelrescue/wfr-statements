import 'server-only'
import type { ManagementLine, ManagementStatement, RosterEntry } from '@/lib/manage/types'
import { airtableFetch } from './client'
import {
  FIELDS,
  INVOICE_MATRIX_TABLE,
  STATEMENTS_TABLE,
  STATEMENT_LINES_TABLE,
} from './fields'
import { assertRecordId } from './recordId'

type AirtableRecord = { id: string; fields: Record<string, unknown> }
type Page = { records: AirtableRecord[]; offset?: string }

/** Single-selects come back as `{ id, name }`; everything else as a scalar. */
function text(cell: unknown): string {
  if (typeof cell === 'string') return cell
  if (typeof cell === 'number') return String(cell)
  if (cell && typeof cell === 'object' && 'name' in cell) {
    return String((cell as { name: unknown }).name ?? '')
  }
  return ''
}

function num(cell: unknown): number {
  return typeof cell === 'number' ? cell : 0
}

/**
 * Read over the API, a link field is an array of record ids. The object form
 * `[{ id, name }]` is accepted too: a link that failed to resolve would make
 * every line fail its parent check and the cost breakdown read as empty
 * rather than erroring, which is not a failure worth risking for one branch.
 */
function firstLinkId(cell: unknown): string {
  if (!Array.isArray(cell) || cell.length === 0) return ''
  const first = cell[0]
  if (typeof first === 'string') return first
  if (first && typeof first === 'object' && typeof (first as { id?: unknown }).id === 'string') {
    return (first as { id: string }).id
  }
  return ''
}

/** Follows Airtable's offset pagination to completion. */
async function fetchAll(path: string, query: string): Promise<AirtableRecord[]> {
  const records: AirtableRecord[] = []
  let offset: string | undefined
  do {
    const page = (await airtableFetch(
      `${path}?${query}${offset ? `&offset=${encodeURIComponent(offset)}` : ''}`,
    )) as Page
    records.push(...page.records)
    offset = page.offset
  } while (offset)
  return records
}

function toStatement(record: AirtableRecord): ManagementStatement {
  const attachments = record.fields.PDF
  const first =
    Array.isArray(attachments) && attachments.length > 0
      ? (attachments[0] as { url?: unknown })
      : null

  // The primary field is "NAME — Type — date"; its first segment is the
  // contractor's name as it was at submission, which is what their invoice
  // says. Preferred over the live roster name for that reason.
  const label = text(record.fields.Statement)

  return {
    id: record.id,
    reference: text(record.fields.Reference),
    label,
    contractorId:
      text(record.fields['Contractor ID']) || firstLinkId(record.fields.Contractor),
    contractorName: label.split('—')[0]?.trim() ?? '',
    type: text(record.fields.Type),
    periodStart: text(record.fields['Period Start']),
    periodEnd: text(record.fields['Period End']),
    subtotal: num(record.fields.Subtotal),
    gst: num(record.fields.GST),
    reimbursements: num(record.fields.Reimbursements),
    total: num(record.fields.Total),
    gstRegisteredAtSubmission:
      text(record.fields['GST Registered At Submission']) === 'YES',
    status: text(record.fields.Status),
    warnings: text(record.fields.Warnings),
    submittedAt: text(record.fields['Submitted At']),
    pdfUrl: first && typeof first.url === 'string' ? first.url : null,
    supersedesId: firstLinkId(record.fields.Supersedes) || null,
  }
}

/**
 * Every statement whose Period End falls in the range — **all statuses and
 * both types**. Superseded and blank-Status rows are included on purpose:
 * they are the Exceptions view's subject, and filtering them out here would
 * make that view impossible.
 *
 * `Period End` is an Airtable Date field. Comparing a Date field against a
 * string literal is not reliable formula semantics — the same class of bug
 * that already required DATESTR() in findSubmittedStatement and a separate
 * Contractor ID field in listStatementsForContractor. Do not simplify these
 * to string comparisons.
 *
 * Airtable offers exactly three date comparisons — IS_AFTER, IS_BEFORE and
 * IS_SAME — so an inclusive range has to be spelled out as "after or same"
 * and "before or same". There is no IS_ON_OR_AFTER, however plausible it
 * sounds; a formula naming a function that does not exist is rejected with a
 * 422 at request time, which means the page 500s in production rather than
 * failing at build. IS_SAME is given the 'day' unit so a Date field's
 * time-of-day can never exclude a statement that lands on a boundary.
 */
export async function listStatementsInRange(
  startIso: string,
  endIso: string,
): Promise<ManagementStatement[]> {
  const start = `DATETIME_PARSE("${startIso}", "YYYY-MM-DD")`
  const end = `DATETIME_PARSE("${endIso}", "YYYY-MM-DD")`
  const formula =
    `AND(` +
    `OR(IS_AFTER({Period End}, ${start}), IS_SAME({Period End}, ${start}, 'day')), ` +
    `OR(IS_BEFORE({Period End}, ${end}), IS_SAME({Period End}, ${end}, 'day'))` +
    `)`

  const records = await fetchAll(
    `/${STATEMENTS_TABLE}`,
    `filterByFormula=${encodeURIComponent(formula)}&pageSize=100`,
  )

  return records
    .map(toStatement)
    .sort((a, b) => a.contractorName.localeCompare(b.contractorName))
}

/**
 * A single statement by record id, or null when it does not exist. The id
 * arrives from a URL path segment, so it is shape-checked before it reaches
 * an Airtable URL — a malformed id returns null (a 404 page) rather than
 * either a 500 or a path-traversal attempt.
 */
export async function getStatement(id: string): Promise<ManagementStatement | null> {
  try {
    assertRecordId(id)
    return toStatement((await airtableFetch(`/${STATEMENTS_TABLE}/${id}`)) as AirtableRecord)
  } catch {
    return null
  }
}

/** Airtable formulas get unwieldy past this many OR clauses. */
const CHUNK = 25

/**
 * Statement Lines for a set of parent statements.
 *
 * The filter matches the parent's **label**, not its record id: inside a
 * formula, `{Statement}` resolves to the linked record's primary field text,
 * exactly as `{Contractor}` did in the bug documented under "Why Contractor
 * ID exists". Filtering on a record id here would silently match nothing.
 *
 * Attribution goes the other way. Read over the API, the same link field
 * comes back as an array of record ids, so each line is mapped to its parent
 * by id — no mirror field needed. A mirror field would have been a write-path
 * change that only populated for lines created after it shipped, leaving
 * every existing statement's lines unreachable.
 */
export async function listLinesForStatements(
  statements: Array<{ id: string; label: string }>,
): Promise<ManagementLine[]> {
  if (statements.length === 0) return []

  const wanted = new Set(statements.map((s) => s.id))
  const lines: ManagementLine[] = []

  for (let i = 0; i < statements.length; i += CHUNK) {
    const chunk = statements.slice(i, i + CHUNK)
    const formula = `OR(${chunk
      // A double quote in a contractor's name would otherwise terminate the
      // string literal and produce an invalid formula.
      .map((s) => `{Statement}="${s.label.replace(/"/g, '\\"')}"`)
      .join(',')})`

    const records = await fetchAll(
      `/${STATEMENT_LINES_TABLE}`,
      `filterByFormula=${encodeURIComponent(formula)}&pageSize=100`,
    )

    lines.push(
      ...records
        .map((r) => ({
          id: r.id,
          statementId: firstLinkId(r.fields.Statement),
          date: text(r.fields.Date) || null,
          lineType: text(r.fields['Line Type']),
          quantity: num(r.fields.Quantity),
          unitRate: num(r.fields['Unit Rate']),
          amount: num(r.fields.Amount),
          description: text(r.fields.Description),
        }))
        // A superseded statement and its replacement share a label, so the
        // filter can return lines from a statement we did not ask for.
        .filter((line) => wanted.has(line.statementId)),
    )
  }
  return lines
}

/**
 * The contractor roster. `PIN` is read only to derive `hasPin` and is never
 * returned — nothing outside this function ever sees a PIN value.
 */
export async function listRoster(): Promise<RosterEntry[]> {
  const records = await fetchAll(
    `/${INVOICE_MATRIX_TABLE}`,
    'pageSize=100&returnFieldsByFieldId=true',
  )

  return records
    .map((r) => ({
      id: r.id,
      // Technician, not Name — invoices are built from Technician, so the
      // dashboard must agree with what the contractor's invoice says.
      name: text(r.fields[FIELDS.technician]),
      city: text(r.fields[FIELDS.city]),
      van: text(r.fields[FIELDS.van]),
      abn: text(r.fields[FIELDS.abn]),
      gstRegistered: text(r.fields[FIELDS.gstRegistered]).toUpperCase() === 'YES',
      // By field ID, not the name used on the login path: this read passes
      // returnFieldsByFieldId=true, under which a name lookup finds nothing.
      hasPin: text(r.fields[FIELDS.pin]).trim() !== '',
    }))
    .filter((entry) => entry.name !== '')
    .sort((a, b) => a.name.localeCompare(b.name))
}
