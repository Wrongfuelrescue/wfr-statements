import type { LineType, StatementTotals } from './types'

/** Shown when the contractor has no GST registration on file. */
export const NOT_REGISTERED_NOTE = 'Contractor is not registered for GST.'

/**
 * The single GST-related note to show alongside a statement's totals, or
 * null when none applies. All three display surfaces (on-screen running
 * total, the review screen, and the PDF) call this so they can never
 * disagree about what to tell the contractor.
 */
export function gstNote(totals: StatementTotals): string | null {
  if (!totals.gstRegistered) return NOT_REGISTERED_NOTE
  return null
}

const BONUS_LINE_TYPES: ReadonlySet<LineType> = new Set([
  'Google Review Bonus',
  'Fuel Filter Sales Bonus $30',
  'Fuel Filter Sales Bonus $70',
])

/**
 * The label for a statement's earnings subtotal — shown by the on-screen
 * running total, the review screen (via ClaimSummary) and the PDF, which all
 * call this so they can never disagree. A monthly bonus statement has no
 * "work" on it, so labelling its subtotal "Work subtotal" reads oddly; a
 * statement is a bonus statement when every one of its earnings lines is a
 * bonus line type. An empty statement (no lines yet, e.g. a form the
 * contractor hasn't started filling in) defaults to "Work subtotal" — there
 * is nothing in its content yet to say otherwise.
 */
export function subtotalLabel(totals: StatementTotals): string {
  const allBonus =
    totals.lines.length > 0 && totals.lines.every((line) => BONUS_LINE_TYPES.has(line.lineType))
  return allBonus ? 'Subtotal (bonuses)' : 'Work subtotal'
}
