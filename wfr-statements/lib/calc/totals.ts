import { GST_RATE, roundMoney } from './money'
import type { StatementLine, StatementTotals } from './types'

/**
 * Roll a flat list of lines into statement totals.
 *
 * Two separate ideas are at play here, and they must not be conflated:
 *
 * - Which bucket a line belongs to (earnings vs. pass-through expense) is
 *   decided by lineType: a Reimbursement is an expense the contractor is
 *   being repaid for, everything else is earnings.
 * - Whether a line attracts GST is decided independently by gstBearing.
 *   Reimbursements are the only lines that never attract GST, but they are
 *   pass-through expenses, not earnings — they land in reimbursements, not
 *   workSubtotal.
 *
 * GST applies only to the GST-bearing subtotal (gstBase), which is a subset
 * of workSubtotal. Reimbursements sit below the GST line and are added to
 * the total untouched, because they are pass-through expenses rather than
 * earnings.
 */
export function rollUpTotals(
  lines: StatementLine[],
  gstRegistered: boolean,
): StatementTotals {
  const workSubtotal = roundMoney(
    lines
      .filter((l) => l.lineType !== 'Reimbursement')
      .reduce((sum, l) => sum + l.amount, 0),
  )
  const reimbursements = roundMoney(
    lines
      .filter((l) => l.lineType === 'Reimbursement')
      .reduce((sum, l) => sum + l.amount, 0),
  )
  const gstBase = roundMoney(
    lines.filter((l) => l.gstBearing).reduce((sum, l) => sum + l.amount, 0),
  )
  const gst = gstRegistered ? roundMoney(gstBase * GST_RATE) : 0
  const total = roundMoney(workSubtotal + gst + reimbursements)

  return { lines, workSubtotal, gstBase, gst, reimbursements, total, gstRegistered, note: null }
}
