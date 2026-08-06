import type { ManagementStatement, RosterEntry } from './types'

export type GstRow = {
  contractorId: string
  contractorName: string
  subtotal: number
  gst: number
  registered: boolean
  abnOnFile: boolean
}

export type GstPosition = {
  rows: GstRow[]
  totalGst: number
  totalSubtotal: number
  /** Treated as GST-free. Shown so the open accountant question has a number. */
  totalReimbursements: number
  /**
   * GST charged on invoices carrying no supplier ABN. WFR cannot claim a
   * credit for it, and the payment additionally attracts 47% withholding.
   */
  unclaimableGst: number
  noAbnCount: number
  statementCount: number
}

function round(value: number): number {
  return Number(value.toFixed(2))
}

export function buildGstPosition(
  statements: ManagementStatement[],
  roster: RosterEntry[],
): GstPosition {
  const byId = new Map(roster.map((entry) => [entry.id, entry]))
  const payable = statements.filter((s) => s.status === 'Submitted')
  const rows = new Map<string, GstRow>()

  for (const statement of payable) {
    const existing = rows.get(statement.contractorId)
    if (existing) {
      existing.subtotal = round(existing.subtotal + statement.subtotal)
      existing.gst = round(existing.gst + statement.gst)
      continue
    }
    rows.set(statement.contractorId, {
      contractorId: statement.contractorId,
      contractorName: statement.contractorName,
      subtotal: statement.subtotal,
      gst: statement.gst,
      registered: statement.gstRegisteredAtSubmission,
      // A contractor no longer on the roster has no ABN we can read, which is
      // the same problem as a blank one — treat it as such rather than
      // silently assuming the invoice is claimable.
      abnOnFile: (byId.get(statement.contractorId)?.abn ?? '') !== '',
    })
  }

  const list = [...rows.values()].sort(
    (a, b) => b.gst - a.gst || a.contractorName.localeCompare(b.contractorName),
  )

  return {
    rows: list,
    totalGst: round(list.reduce((running, row) => running + row.gst, 0)),
    totalSubtotal: round(list.reduce((running, row) => running + row.subtotal, 0)),
    totalReimbursements: round(payable.reduce((running, s) => running + s.reimbursements, 0)),
    unclaimableGst: round(
      list.filter((row) => !row.abnOnFile).reduce((running, row) => running + row.gst, 0),
    ),
    noAbnCount: list.filter((row) => !row.abnOnFile).length,
    statementCount: payable.length,
  }
}
