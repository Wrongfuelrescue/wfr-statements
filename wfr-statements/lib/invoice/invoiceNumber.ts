/**
 * Contractors keep their own invoice sequences, so the number on the invoice
 * is theirs to set. The app only suggests one.
 *
 * The number is collected, validated and stored on the Airtable record, where
 * WFR reconciles against it — but it is no longer printed on the invoice
 * itself, at the client's request. The app's own `INV-` reference
 * (lib/reference.ts) is the single identifier on the face of the document:
 * two contractors could each submit "INV-001", so only the reference
 * identifies a statement unambiguously.
 */
export const MAX_INVOICE_NUMBER_LENGTH = 40

/** Date-derived and stable, so the same period always suggests the same number. */
export function suggestInvoiceNumber(periodEnd: string): string {
  return `WFR-${periodEnd.replace(/-/g, '')}`
}

/**
 * Shared by the form and the route handler so the client and the server
 * cannot disagree about what is acceptable. Control characters are rejected
 * because they corrupt the value WFR reconciles against in Airtable, showing
 * as blanks or box glyphs in a field a human has to read and match.
 */
export function validateInvoiceNumber(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('Enter the invoice number you want on this invoice.')
  }

  const trimmed = value.trim()

  if (trimmed === '') {
    throw new Error('Enter the invoice number you want on this invoice.')
  }

  if (trimmed.length > MAX_INVOICE_NUMBER_LENGTH) {
    throw new Error(
      `An invoice number cannot be longer than ${MAX_INVOICE_NUMBER_LENGTH} characters.`,
    )
  }

  if (/[\x00-\x1f\x7f]/.test(trimmed)) {
    throw new Error('That invoice number contains characters that cannot be printed.')
  }

  return trimmed
}
