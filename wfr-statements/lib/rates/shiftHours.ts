/**
 * How many hours a full shift runs, by the contractor's Shift pattern. Used
 * only to price an Adjusted shift pro-rata against their base shift rate.
 *
 * These divisors come from WFR, not from the rates. They sanity-check well
 * against them though: 425/11, 400/11 and 325/8.5 give effective hourly rates
 * of $38.64, $36.36 and $38.24 — within $2.30 of each other across all three
 * tiers.
 *
 * An unknown pattern returns null rather than guessing a divisor. Pricing
 * someone's partial day against an invented shift length would silently pay
 * them the wrong amount; the Adjusted shift option is hidden instead.
 */
const HOURS_BY_PATTERN: ReadonlyArray<[string, number]> = [
  ['week on / week off', 11],
  ['monday - friday', 8.5],
]

export function standardDayHours(shiftPattern: string): number | null {
  const normalised = shiftPattern.trim().toLowerCase()
  const match = HOURS_BY_PATTERN.find(([pattern]) => pattern === normalised)
  return match ? match[1] : null
}
