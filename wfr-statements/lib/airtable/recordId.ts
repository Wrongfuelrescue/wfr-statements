const RECORD_ID_PATTERN = /^rec[A-Za-z0-9]{14}$/

/**
 * Thrown by `assertRecordId` when a value does not have the shape of a real
 * Airtable record id. Callers that read a record id from an unauthenticated
 * or otherwise untrusted source (e.g. the login route's request body) should
 * catch this specifically and return a clean, generic 400 rather than let it
 * surface as an unhandled 500.
 */
export class InvalidRecordIdError extends Error {
  constructor(id: unknown) {
    super(`Invalid Airtable record id: ${JSON.stringify(id)}`)
    this.name = 'InvalidRecordIdError'
  }
}

/**
 * Every record id that reaches an Airtable URL path segment or a
 * filterByFormula string must pass through here first. Airtable record ids
 * are a fixed shape — `rec` followed by 14 alphanumeric characters — so
 * anything else is either a bug or a crafted request probing for path
 * traversal (`../..`) or formula injection (a quote that breaks out of a
 * `{Field}="..."` clause). All 21 contractor record ids are effectively
 * public (served unauthenticated on the login page), so this is a cheap
 * defence-in-depth check, not a secrecy boundary.
 */
export function assertRecordId(id: string): void {
  if (typeof id !== 'string' || !RECORD_ID_PATTERN.test(id)) {
    throw new InvalidRecordIdError(id)
  }
}
