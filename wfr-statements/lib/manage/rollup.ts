import { bucketEndFor, isOnCycle } from './fortnight'
import type { ManagementLine, ManagementStatement, RosterEntry } from './types'

/**
 * Only a Submitted statement is money owed. A blank Status is an incomplete
 * write and a Superseded one has been replaced — neither may be reconciled
 * against, so neither counts toward a total or marks a contractor as having
 * submitted. Both still appear on the Exceptions page.
 */
function isPayable(statement: ManagementStatement): boolean {
  return statement.status === 'Submitted'
}

function round(value: number): number {
  return Number(value.toFixed(2))
}

export type PayRunRow = {
  contractorId: string
  contractorName: string
  statement: ManagementStatement | null
  /** The statement's Period End is not on a real pay-run boundary. */
  offCycle: boolean
}

export type PayRun = {
  rows: PayRunRow[]
  bonuses: ManagementStatement[]
  totalPayable: number
  totalGst: number
  totalReimbursements: number
  submittedCount: number
  expectedCount: number
}

export function buildPayRun(
  fortnightEnd: string,
  statements: ManagementStatement[],
  roster: RosterEntry[],
): PayRun {
  const inFortnight = statements.filter(
    (s) => isPayable(s) && bucketEndFor(s.periodEnd) === fortnightEnd,
  )
  const fortnightly = inFortnight.filter((s) => s.type !== 'Monthly Bonus')
  const bonuses = inFortnight.filter((s) => s.type === 'Monthly Bonus')

  // Expected = anyone who can actually log in. A blank PIN means a contractor
  // cannot sign in at all, which makes it a de facto active flag.
  const rows: PayRunRow[] = roster
    .filter((entry) => entry.hasPin)
    .map((entry) => {
      const statement = fortnightly.find((s) => s.contractorId === entry.id) ?? null
      return {
        contractorId: entry.id,
        contractorName: entry.name,
        statement,
        offCycle: statement !== null && !isOnCycle(statement.periodEnd),
      }
    })

  // A statement from someone no longer on the roster is still real money and
  // must never vanish from the pay run just because their row changed.
  for (const statement of fortnightly) {
    if (rows.some((row) => row.contractorId === statement.contractorId)) continue
    rows.push({
      contractorId: statement.contractorId,
      contractorName: statement.contractorName,
      statement,
      offCycle: !isOnCycle(statement.periodEnd),
    })
  }

  rows.sort((a, b) => a.contractorName.localeCompare(b.contractorName))

  const paid = [...fortnightly, ...bonuses]
  const sum = (pick: (s: ManagementStatement) => number) =>
    round(paid.reduce((running, s) => running + pick(s), 0))

  return {
    rows,
    bonuses,
    totalPayable: sum((s) => s.total),
    totalGst: sum((s) => s.gst),
    totalReimbursements: sum((s) => s.reimbursements),
    submittedCount: rows.filter((row) => row.statement !== null).length,
    expectedCount: rows.length,
  }
}

export type CostGroup =
  | 'Base shifts'
  | 'Rostered days off'
  | 'Additional labour'
  | 'Vehicle servicing'
  | 'Reimbursements'
  | 'Bonuses'
  | 'Other'

/**
 * Keyed by the app's current `LineType` constants (lib/calc/types.ts) **and**
 * the pre-v3 names, in WFR's own accounting terms.
 *
 * Both are needed. The Airtable choices were renamed after v2 shipped, and
 * renaming a single-select choice rewrites what every existing record reads
 * as — so a line the app once wrote as `Base Shift` now comes back as
 * `Sub Contractor Labour Hire`. v3 aligned the app's constants to the new
 * names, but the old spellings are kept here because nothing guarantees a
 * historical row or a future rename matches. Miss one and its lines fall
 * into `Other`, collapsing the category breakdown — silently, since nothing
 * errors. A test asserts every value in the `LineType` union maps to
 * something other than `Other`; that is what catches the next rename.
 *
 * An Adjusted Shift groups with base shifts: it is a base shift priced
 * pro-rata, not a distinct kind of cost.
 */
const GROUPS: Record<string, CostGroup> = {
  // As the app writes them.
  'Base Shift': 'Base shifts',
  'Adjusted Shift': 'Base shifts',
  'Rostered Day-off': 'Rostered days off',
  'Additional Labour': 'Additional labour',
  'Minor Service': 'Vehicle servicing',
  'Major Service': 'Vehicle servicing',
  Reimbursement: 'Reimbursements',
  'Google Review Bonus': 'Bonuses',
  'Fuel Filter $30': 'Bonuses',
  'Fuel Filter $70': 'Bonuses',
  // As the app writes them since v3, and as they read in the live base.
  'Sub Contractor Labour Hire': 'Base shifts',
  'Sub Contractor Labour Hire Rate': 'Base shifts',
  'Sub Contractor Labour Hire - RDA Rate': 'Rostered days off',
  'Sub Contractor Labour Hire - Adjusted Hours': 'Base shifts',
  'Sub Contractor Labour Hire - Additional Hours': 'Additional labour',
  'Fuel Filter Sales Bonus $30': 'Bonuses',
  'Fuel Filter Sales Bonus $70': 'Bonuses',
}

/**
 * Falls back to 'Other' so a line type added later stays visible rather than
 * being dropped from the total. En dashes are normalised to hyphens first —
 * the renamed choices use an en dash, and a typo'd hyphen must not read as a
 * separate category.
 */
export function groupForLineType(lineType: string): CostGroup {
  return GROUPS[lineType.replace(/–/g, '-')] ?? 'Other'
}

export type Slice = { key: string; amount: number; share: number }

function toSlices(totals: Map<string, number>): Slice[] {
  const grand = [...totals.values()].reduce((a, b) => a + b, 0)
  if (grand === 0) return []
  return [...totals.entries()]
    .map(([key, amount]) => ({ key, amount: round(amount), share: amount / grand }))
    .sort((a, b) => b.amount - a.amount || a.key.localeCompare(b.key))
}

export function rollUpByGroup(lines: ManagementLine[]): Slice[] {
  const totals = new Map<string, number>()
  for (const line of lines) {
    const group = groupForLineType(line.lineType)
    totals.set(group, (totals.get(group) ?? 0) + line.amount)
  }
  return toSlices(totals)
}

/**
 * Cost by city or van, ex-GST (subtotal plus reimbursements — the total minus
 * GST, which WFR reclaims). City and van are read live from INVOICE MATRIX,
 * so a contractor who changes van re-attributes their whole history.
 */
export function rollUpByDimension(
  statements: ManagementStatement[],
  roster: RosterEntry[],
  dimension: 'city' | 'van',
): Slice[] {
  const byId = new Map(roster.map((entry) => [entry.id, entry]))
  const totals = new Map<string, number>()

  for (const statement of statements) {
    if (!isPayable(statement)) continue
    const key = byId.get(statement.contractorId)?.[dimension] || 'Unknown'
    totals.set(key, (totals.get(key) ?? 0) + statement.subtotal + statement.reimbursements)
  }
  return toSlices(totals)
}
