export class RateParseError extends Error {
  readonly fieldLabel: string

  constructor(fieldLabel: string, raw: string) {
    super(
      `Rate for "${fieldLabel}" could not be read (value: "${raw}"). ` +
        'Contact WFR accounts to correct this rate.',
    )
    this.name = 'RateParseError'
    this.fieldLabel = fieldLabel
  }
}

const NOT_APPLICABLE = /^n\/?a$/i

const NUMERIC_PATTERN = /^\d+(\.\d+)?$/

/**
 * Airtable stores every rate as singleSelect *text*, so it must be parsed
 * defensively. `N/A` and blank both mean "contractor cannot claim this" and
 * return null. Anything else that is not a positive number throws — a rate we
 * cannot read must never silently become $0 on a statement backing an invoice.
 *
 * Tolerates: leading/trailing whitespace, a single leading `$`, and commas
 * as thousands separators (e.g., `$1,425.50` or ` 42.5 `).
 *
 * Rejects: internal spaces, scientific notation, multiple decimal points, or
 * any other non-numeric character. A malformed rate must throw, never silently
 * become a wrong number.
 */
export function parseRate(
  raw: string | null | undefined,
  fieldLabel: string,
): number | null {
  if (raw === null || raw === undefined) return null

  const trimmed = raw.trim()
  if (trimmed === '') return null
  if (NOT_APPLICABLE.test(trimmed)) return null

  // Remove only leading $ and commas (thousands separators), nothing else
  const cleaned = trimmed.replace(/^\$/, '').replace(/,/g, '')

  // Validate against strict pattern: digits, optionally followed by decimal and more digits
  if (!NUMERIC_PATTERN.test(cleaned)) {
    throw new RateParseError(fieldLabel, trimmed)
  }

  const value = Number(cleaned)

  if (!Number.isFinite(value) || value <= 0) {
    throw new RateParseError(fieldLabel, trimmed)
  }

  return value
}
