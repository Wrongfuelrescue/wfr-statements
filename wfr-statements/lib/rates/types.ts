/** Raw string values pulled straight off an INVOICE MATRIX record. */
export type RawContractorRecord = {
  id: string
  technician: string
  abn: string
  address: string
  bankAccount: string
  bankBsb: string
  van: string
  city: string
  shiftPattern: string
  gstRegistered: string
  baseShift: string
  additionalLabour: string
  rosteredDayOff: string
  minorService: string
  majorService: string
  googleReviewBonus: string
  fuelFilter30: string
  fuelFilter70: string
}

/** Parsed, validated rates for one contractor. `null` means "cannot claim". */
export type RateCard = {
  contractorId: string
  name: string
  /** Contractor's own ABN, for their invoice. Empty when WFR has not set it. */
  abn: string
  /** Contractor's business address. Empty when WFR has not set it. */
  address: string
  /** Contractor's bank account number, for the invoice's payment block. */
  bankAccount: string
  /** Contractor's BSB. */
  bankBsb: string
  /**
   * Hours in a full shift, used to price an Adjusted shift pro-rata. Null when
   * the contractor's Shift pattern is not one we have a length for — the
   * Adjusted shift option is then hidden rather than priced on a guess.
   */
  standardDayHours: number | null
  van: string
  city: string
  shiftPattern: string
  gstRegistered: boolean
  baseShift: number
  additionalLabour: number
  rosteredDayOff: number
  minorService: number | null
  majorService: number | null
  googleReviewBonus: number
  fuelFilter30: number
  fuelFilter70: number
}
