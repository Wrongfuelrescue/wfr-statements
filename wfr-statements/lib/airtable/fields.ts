/** The only file that knows Airtable field IDs. Values verified against the live base. */
export const INVOICE_MATRIX_TABLE = 'tblEKgseTcvYkoBaH'

export const FIELDS = {
  name: 'fldERemro0XSNQZrA',
  technician: 'fldmcoKmZ64smsy4d',
  van: 'fldooFZGxLjvrLxkG',
  gstRegistered: 'fldyP4CHwcp6r05zE',
  city: 'fldBxnlmA8rBPM1NS',
  shift: 'fldGDkGk8Kjy4j1hM',
  baseShift: 'flddgoMGOj5vR3Go9',
  additionalLabour: 'fldHuoG3JKyGk3seq',
  rosteredDayOff: 'fldMBUjew9UuKs0nq',
  minorService: 'fldcuA9UalmlZer2P',
  majorService: 'flduDQzxiBskvSX8Q',
  googleReviewBonus: 'fldjnnh4qTqY7nIms',
  fuelFilter30: 'fldddN0yCXfmgi3sM',
  fuelFilter70: 'fldBsKeIlXojlaNu0',
  abn: 'fldPJYhQLpDjXt6j4',
  address: 'fldfWCMFfCN8t7Ptt',
  bankAccount: 'fldVootsnyHDxRnn8',
  bankBsb: 'fldZSPK2cDIysLtya',
  /**
   * By ID as well as by name (`NEW_FIELDS.pin`) because the two reads address
   * it differently: the login path fetches by name, while `listRoster` uses
   * `returnFieldsByFieldId=true` and would find nothing under `'PIN'`. That
   * would silently report every contractor as unable to log in, emptying the
   * pay run's outstanding list rather than failing loudly.
   */
  pin: 'fld6CFxmZTBfqaymw',
} as const

/**
 * Added in Task 15. Referenced by name rather than ID because they do not exist
 * in the base until then; Airtable accepts field names in the write API.
 */
export const NEW_FIELDS = {
  email: 'Email',
  pin: 'PIN',
  failedAttempts: 'Failed Attempts',
  lockedUntil: 'Locked Until',
} as const

/** Created in Task 15. Writes use field *names*, which Airtable accepts. */
export const STATEMENTS_TABLE = 'tblaqyvsGwyHba8SD'
export const STATEMENT_LINES_TABLE = 'tblyuiblozI2vbRwL'
