/**
 * All date maths runs in UTC on ISO yyyy-mm-dd strings. Statement periods are
 * calendar dates, not instants, so timezone conversion would only introduce
 * off-by-one bugs.
 */

function toUtc(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Formatted explicitly rather than via toLocaleDateString. ICU's en-AU skeleton
 * expands a short month to its full name when a weekday is present, and the
 * exact output varies by host ICU build — unacceptable drift for a document
 * that backs an invoice. This is deterministic everywhere.
 */
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export function addDays(iso: string, days: number): string {
  const date = toUtc(iso)
  date.setUTCDate(date.getUTCDate() + days)
  return toIso(date)
}

/** Contractors normally submit on a Monday evening, so this is the sensible default. */
export function mostRecentMonday(today: Date): string {
  const date = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  )
  // getUTCDay: 0 = Sunday, 1 = Monday
  const offset = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - offset)
  return toIso(date)
}

export function fortnightDates(startIso: string): string[] {
  return Array.from({ length: 14 }, (_, i) => addDays(startIso, i))
}

export function formatDisplayDate(iso: string): string {
  const date = toUtc(iso)
  return `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`
}

/**
 * Same as `formatDisplayDate`, plus the year. Statements back real payment
 * claims filed for tax — `Mon 4 Aug` alone is indistinguishable from the
 * same fortnight a year later, so anywhere a date stands alone as a record
 * of *when* (the PDF's Period row, the submissions list, the review screen)
 * must carry the year. The bare per-line Date column in the 14-day table
 * stays on `formatDisplayDate`: it is always read alongside the Period row
 * that already states the year, and the column is too tight to spare the
 * width.
 */
export function formatDisplayDateWithYear(iso: string): string {
  const date = toUtc(iso)
  return (
    `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} ` +
    `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`
  )
}

/** `monthIso` is yyyy-mm. Day 0 of the next month is the last day of this one. */
export function monthRange(monthIso: string): { start: string; end: string } {
  const [y, m] = monthIso.split('-').map(Number)
  return {
    start: toIso(new Date(Date.UTC(y, m - 1, 1))),
    end: toIso(new Date(Date.UTC(y, m, 0))),
  }
}

/**
 * Contractors are paid on a fortnight that ends on a Sunday, so the most
 * recent Sunday is the end of the fortnight just finished — the sensible
 * default for the date picker.
 */
export function mostRecentSunday(today: Date): string {
  const date = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  )
  // getUTCDay: 0 = Sunday
  date.setUTCDate(date.getUTCDate() - date.getUTCDay())
  return toIso(date)
}

/**
 * The first day of the fortnight ending on `endIso`. Thirteen days back, not
 * fourteen — the period is fourteen days *inclusive* of both ends.
 */
export function fortnightStartFromEnd(endIso: string): string {
  return addDays(endIso, -13)
}

/** The fourteen dates of the fortnight ending on `endIso`, in order. */
export function fortnightDatesEndingOn(endIso: string): string[] {
  return fortnightDates(fortnightStartFromEnd(endIso))
}

/**
 * Derives the Perth (Australia/WA) calendar date from a UTC instant, for the
 * invoice's "Date" field — the only date on this app that starts life as an
 * instant (`submittedAt`) rather than a calendar date, so it's the only one
 * that needs a timezone at all. Every other date here is deliberately kept
 * as a bare yyyy-mm-dd and handled in UTC to avoid off-by-one drift; this one
 * is different because a statement submitted late evening AEST can already
 * be "tomorrow" further west, and WFR's registered address is in WA.
 *
 * Perth runs UTC+8 year-round (no daylight saving), so simply offsetting the
 * instant by 8 hours and reading off the UTC calendar date gives the correct
 * Perth wall-clock date — deterministic everywhere, unlike toLocaleDateString
 * (see formatDisplayDate above), whose output depends on the host's ICU data.
 */
const PERTH_OFFSET_MS = 8 * 60 * 60 * 1000

export function perthDateFromInstant(instantIso: string): string {
  const instant = new Date(instantIso)
  return toIso(new Date(instant.getTime() + PERTH_OFFSET_MS))
}
