import { addDays } from '@/lib/dates'
import type { DayEntry, Reimbursement } from '@/lib/calc/types'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const ISO_MONTH = /^\d{4}-\d{2}$/

/**
 * Sanity ceiling on a single day's additional labour claim. Guards against a
 * malformed or crafted request, not normal use — a real contractor's day
 * never gets close to it. Kept here (not lib/calc) because lib/calc stays
 * pure money logic with no notion of what counts as a "request", crafted or
 * otherwise.
 */
export const MAX_ADDITIONAL_LABOUR_HOURS_PER_DAY = 24

/**
 * Sanity ceiling on the fortnight's single reimbursement — same reasoning as
 * MAX_ADDITIONAL_LABOUR_HOURS_PER_DAY above, just at the fortnight level now
 * the reimbursement lives there rather than on each day.
 */
export const MAX_REIMBURSEMENT_AMOUNT_PER_FORTNIGHT = 10_000

/**
 * `request.json()` gives no runtime guarantee about `periodStart` — a
 * malformed value (missing, wrong shape, wrong type) must never reach the
 * date helpers, which throw an internal, unreadable message
 * (`Cannot read properties of undefined (reading 'split')`) that would
 * otherwise leak straight through to the contractor as a 400.
 */
export function validatePeriodStart(periodStart: unknown): string {
  if (typeof periodStart !== 'string' || !ISO_DATE.test(periodStart)) {
    throw new Error(
      'That fortnight start date does not look right. Please pick it again and try submitting once more.',
    )
  }
  return periodStart
}

/** Same guarantee as `validatePeriodStart`, for the fortnightly form's `periodEnd` field. */
export function validatePeriodEnd(periodEnd: unknown): string {
  if (typeof periodEnd !== 'string' || !ISO_DATE.test(periodEnd)) {
    throw new Error(
      'That fortnight ending date does not look right. Please pick it again and try submitting once more.',
    )
  }
  return periodEnd
}

/** Same guarantee as `validatePeriodStart`, for the monthly form's `month` field. */
export function validateMonth(month: unknown): string {
  if (typeof month !== 'string' || !ISO_MONTH.test(month)) {
    throw new Error(
      'That month does not look right. Please pick it again and try submitting once more.',
    )
  }
  return month
}

/**
 * Confirms every submitted day genuinely belongs to the fortnight the
 * statement claims to cover, and that no date is repeated. Without this, a
 * crafted request could carry a header claiming a 14-day period while its
 * lines span months, or double-count a single day by submitting it twice —
 * neither of which `calculateFortnightly` (which only sorts and sums
 * whatever it is given) would ever catch on its own.
 *
 * Also enforces the per-day sanity ceiling on additional labour hours. This
 * runs here, before `calculateFortnightly`, so a malformed magnitude is
 * rejected with a message a contractor can act on rather than merely
 * producing an oversized statement.
 */
export function validateFortnightlyDays(days: DayEntry[], periodStart: string): void {
  const periodEnd = addDays(periodStart, 13)
  const seen = new Set<string>()

  for (const day of days) {
    if (typeof day?.date !== 'string' || !ISO_DATE.test(day.date)) {
      throw new Error(
        'One of the entered dates does not look right. Please refresh the page and try again.',
      )
    }

    if (day.date < periodStart || day.date > periodEnd) {
      throw new Error(
        `${day.date} falls outside the selected fortnight (${periodStart} – ${periodEnd}). ` +
          'Please refresh the page and try again.',
      )
    }

    if (seen.has(day.date)) {
      throw new Error(`${day.date} was submitted more than once. Please refresh and try again.`)
    }
    seen.add(day.date)

    if (
      typeof day.additionalLabourHours === 'number' &&
      day.additionalLabourHours > MAX_ADDITIONAL_LABOUR_HOURS_PER_DAY
    ) {
      throw new Error(
        `Additional labour on ${day.date} cannot exceed ${MAX_ADDITIONAL_LABOUR_HOURS_PER_DAY} hours ` +
          'in a single day. Contact WFR accounts if this is correct.',
      )
    }

    // Sanity ceiling on adjusted-shift hours — same reasoning as the
    // additional-labour ceiling above. calculateFortnightly separately
    // enforces the real cap (the contractor's standardDayHours); this only
    // guards a malformed or crafted request before it gets that far.
    if (
      typeof day.adjustedHours === 'number' &&
      day.adjustedHours > MAX_ADDITIONAL_LABOUR_HOURS_PER_DAY
    ) {
      throw new Error(
        `Adjusted hours on ${day.date} cannot exceed ${MAX_ADDITIONAL_LABOUR_HOURS_PER_DAY} hours ` +
          'in a single day. Contact WFR accounts if this is correct.',
      )
    }

    // NaN is typeof 'number', so it silently passes the ceiling check above
    // (NaN > x is always false) and would otherwise reach calculateFortnightly,
    // where (NaN / standardDayHours) * baseShift produces NaN — a total that
    // also clears `totals.total <= 0` (NaN <= 0 is false too). Caught here
    // with a readable message instead.
    if (typeof day.adjustedHours === 'number' && !Number.isFinite(day.adjustedHours)) {
      throw new Error(
        `Adjusted hours on ${day.date} are not a valid number. Please check them and try again.`,
      )
    }
  }
}

/**
 * `body.reimbursement` gives no runtime guarantee — missing, wrong shape, or
 * wrong types must never reach `calculateFortnightly` directly. A missing
 * reimbursement defaults to nothing claimed, the same as an empty form
 * field. Also enforces the sanity ceiling on the fortnight's single
 * reimbursement amount, for the same reason as `validateFortnightlyDays`'s
 * additional-labour ceiling: a malformed magnitude is rejected with a
 * message a contractor can act on rather than merely producing an oversized
 * statement.
 */
export function validateReimbursement(value: unknown): Reimbursement {
  if (value === undefined) {
    return { amount: 0, description: '' }
  }

  const candidate =
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
  const amount = candidate.amount
  const description = candidate.description

  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
    throw new Error(
      'That reimbursement amount does not look right. Please check it and try submitting once more.',
    )
  }

  if (amount > MAX_REIMBURSEMENT_AMOUNT_PER_FORTNIGHT) {
    throw new Error(
      `The reimbursement exceeds the $${MAX_REIMBURSEMENT_AMOUNT_PER_FORTNIGHT.toLocaleString()} ` +
        'limit. Contact WFR accounts if this is correct.',
    )
  }

  if (typeof description !== 'string') {
    throw new Error(
      'That reimbursement description does not look right. Please check it and try submitting once more.',
    )
  }

  return { amount, description }
}
