export type LineType =
  | 'Sub Contractor Labour Hire'
  | 'Sub Contractor Labour Hire – RDA Rate'
  | 'Sub Contractor Labour Hire – Adjusted Hours'
  | 'Sub Contractor Labour Hire – Additional Hours'
  | 'Minor Service'
  | 'Major Service'
  | 'Reimbursement'
  | 'Google Review Bonus'
  | 'Fuel Filter Sales Bonus $30'
  | 'Fuel Filter Sales Bonus $70'

export type ShiftType = 'none' | 'base' | 'rdo' | 'adjusted'
export type ServiceType = 'none' | 'minor' | 'major'

/** One day of a fortnightly statement, as entered by the contractor. */
export type DayEntry = {
  /** ISO yyyy-mm-dd */
  date: string
  shift: ShiftType
  /**
   * Hours actually worked, when `shift` is `'adjusted'`. Zero otherwise.
   * Covers a partial day — illness, an early finish — priced pro-rata against
   * the contractor's base shift rate rather than hourly, so a short day can
   * never pay more than a full one.
   */
  adjustedHours: number
  additionalLabourHours: number
  service: ServiceType
}

/**
 * The fortnight's single reimbursement. One field at the foot of the form
 * rather than one per day: a contractor with several expenses totals them and
 * describes them together. Pass-through expense, never GST-bearing.
 */
export type Reimbursement = {
  amount: number
  description: string
}

/** Self-declared bonus counts for a monthly statement. */
export type BonusEntry = {
  googleReviews: number
  fuelFilter30: number
  fuelFilter70: number
  note: string
}

export type StatementLine = {
  /** ISO yyyy-mm-dd, or null for monthly bonus lines which are period-wide. */
  date: string | null
  lineType: LineType
  quantity: number
  unitRate: number
  amount: number
  description: string
  /**
   * Whether this line attracts GST. This says nothing about which totals
   * bucket the line belongs to — that is decided by lineType (see
   * rollUpTotals). Reimbursements are pass-through expenses and are the only
   * lines that are never GST-bearing.
   */
  gstBearing: boolean
}

export type StatementTotals = {
  lines: StatementLine[]
  workSubtotal: number
  /**
   * Sum of lines that attract GST — a subset of workSubtotal. Comparing this
   * against workSubtotal is how a display surface knows some earnings did
   * not attract GST, without being told out of band.
   */
  gstBase: number
  gst: number
  reimbursements: number
  total: number
  gstRegistered: boolean
  /**
   * A statement-level remark — currently only the monthly bonus statement's
   * free-text note. Deliberately not glued onto any one line's description:
   * the note describes the whole month (e.g. "Reviews from the Tullamarine
   * job"), not whichever bonus line happens to be first, which could be
   * about fuel filters. `null` when there is nothing to show.
   */
  note: string | null
}
