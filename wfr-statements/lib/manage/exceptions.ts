import { isOnCycle } from './fortnight'
import type { ManagementStatement, RosterEntry } from './types'

export type ExceptionKind = 'warnings' | 'incomplete' | 'superseded' | 'off-cycle' | 'no-abn'

export type ExceptionRow = {
  kind: ExceptionKind
  title: string
  /** Null for roster-level exceptions, which have no statement to link to. */
  statementId: string | null
  subject: string
  detail: string
  /** What to do about it, in Airtable. */
  fix: string
}

/**
 * Every fix below is the operational guidance already documented in
 * docs/airtable-schema-setup.md → "What WFR should watch for". Keep the two
 * in sync: this page is where that guidance actually gets read.
 */
export function findExceptions(
  statements: ManagementStatement[],
  roster: RosterEntry[],
): ExceptionRow[] {
  const rows: ExceptionRow[] = []

  for (const statement of statements) {
    const subject = `${statement.contractorName} — ${statement.periodStart} to ${statement.periodEnd}`

    if (statement.warnings !== '') {
      rows.push({
        kind: 'warnings',
        title: 'Supporting evidence missing',
        statementId: statement.id,
        subject,
        detail: statement.warnings,
        fix: 'Totals and lines are correct, but something after submission failed — usually the PDF or a receipt photo. Ask the contractor to re-send it, or re-upload the receipt yourself.',
      })
    }

    if (statement.status === '') {
      rows.push({
        kind: 'incomplete',
        title: 'Incomplete write',
        statementId: statement.id,
        subject,
        detail:
          'Status is blank — the write failed partway through, before every line was created.',
        fix: 'Do not reconcile against this row. Check the contractor has a working PDF for the period; they can safely resubmit, since a blank Status does not count as Submitted.',
      })
    }

    if (statement.status === 'Superseded') {
      rows.push({
        kind: 'superseded',
        title: 'Superseded',
        statementId: statement.id,
        subject,
        detail: 'Replaced by a later statement, which carries a different invoice number.',
        fix: 'Pay against the Submitted statement only. This one must not be paid.',
      })
    }

    // Only a fortnightly statement can be off-cycle. A monthly bonus period
    // ends at month end, which is almost never a fortnight boundary — flagging
    // those would fire for every bonus statement every month and teach the
    // reader to ignore this screen.
    if (statement.type !== 'Monthly Bonus' && !isOnCycle(statement.periodEnd)) {
      rows.push({
        kind: 'off-cycle',
        title: 'Off-cycle period',
        statementId: statement.id,
        subject,
        detail: `Period ends ${statement.periodEnd}, which is not a pay-run fortnight ending.`,
        fix: 'The amount is unaffected — the contractor picked the wrong fortnight-ending date. Worth telling them so the next one lines up.',
      })
    }
  }

  // Not period-bound, so this runs across the roster rather than the
  // statements. Restricted to contractors who can actually log in: a row with
  // no PIN is not an active contractor, and its blank ABN is not an
  // outstanding problem.
  for (const entry of roster) {
    if (!entry.hasPin || entry.abn !== '') continue
    rows.push({
      kind: 'no-abn',
      title: 'No ABN on file',
      statementId: null,
      subject: entry.name,
      detail:
        'An invoice with no supplier ABN cannot be claimed against for a GST credit, and obliges WFR to withhold 47% of the payment — whether or not the contractor is registered for GST.',
      fix: 'Add their ABN to their INVOICE MATRIX row. To correct an already-submitted statement, set its Status to Superseded and ask them to resubmit that period.',
    })
  }

  return rows
}
