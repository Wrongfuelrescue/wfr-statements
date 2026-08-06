/** A Statements row as the dashboard reads it. All statuses, both types. */
export type ManagementStatement = {
  id: string
  reference: string
  /**
   * The primary field, `NAME — Type — date`. Carried because a Statement
   * Lines formula filter resolves the link field to this text rather than to
   * a record id — see `listLinesForStatements`.
   */
  label: string
  contractorId: string
  contractorName: string
  type: string
  periodStart: string
  periodEnd: string
  subtotal: number
  gst: number
  reimbursements: number
  total: number
  gstRegisteredAtSubmission: boolean
  /** Empty string when Status is blank — an incomplete write. */
  status: string
  /** Empty string when nothing went wrong. */
  warnings: string
  submittedAt: string
  /** Null when the PDF attach failed, which is a real and documented state. */
  pdfUrl: string | null
  supersedesId: string | null
}

/** A Statement Lines row, with its parent resolved from the link field. */
export type ManagementLine = {
  id: string
  statementId: string
  /** Null for dateless monthly bonus lines. */
  date: string | null
  lineType: string
  quantity: number
  unitRate: number
  amount: number
  description: string
}

/** An INVOICE MATRIX row, reduced to what management needs. */
export type RosterEntry = {
  id: string
  name: string
  city: string
  van: string
  /** Empty string when WFR has not populated it. */
  abn: string
  gstRegistered: boolean
  /**
   * Whether a PIN is set. The PIN value itself never leaves the Airtable
   * module. A blank PIN means the contractor cannot log in at all, which
   * makes this a de facto active flag.
   */
  hasPin: boolean
}
