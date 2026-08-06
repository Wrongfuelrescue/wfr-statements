import { addDays } from '@/lib/dates'

/**
 * A known real pay-run fortnight ending. Every on-cycle boundary is this date
 * plus or minus a multiple of 14 days.
 *
 * Chosen because Sun 2 Aug and Sun 16 Aug 2026 are exactly fourteen days
 * apart and together account for three of the four fortnightly statements in
 * the base. Contractors pick their own fortnight-ending date and nothing in
 * Airtable records which Sundays are real pay boundaries, so this constant is
 * the only source of that truth. If WFR's real cycle runs on the other
 * Sundays, changing it here is the whole fix.
 */
export const FORTNIGHT_ANCHOR = '2026-08-02'

const DAY_MS = 24 * 60 * 60 * 1000
const CYCLE = 14

/** Whole days from the anchor to `iso`. Negative before the anchor. */
function daysFromAnchor(iso: string): number {
  const [ay, am, ad] = FORTNIGHT_ANCHOR.split('-').map(Number)
  const [y, m, d] = iso.split('-').map(Number)
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ay, am - 1, ad)) / DAY_MS)
}

export function isOnCycle(endIso: string): boolean {
  return daysFromAnchor(endIso) % CYCLE === 0
}

/** The fourteen days ending on `endIso`, inclusive of both ends. */
export function fortnightWindow(endIso: string): { start: string; end: string } {
  return { start: addDays(endIso, -(CYCLE - 1)), end: endIso }
}

export function stepFortnight(endIso: string, direction: 1 | -1): string {
  return addDays(endIso, direction * CYCLE)
}

/**
 * The most recently *ended* on-cycle fortnight as of `today` — not the one in
 * progress. A pay run is only reviewable once its period has closed.
 */
export function currentFortnightEnd(today: Date): string {
  const iso = today.toISOString().slice(0, 10)
  return addDays(FORTNIGHT_ANCHOR, Math.floor(daysFromAnchor(iso) / CYCLE) * CYCLE)
}

/**
 * The on-cycle fortnight whose fourteen-day window contains `periodEndIso` —
 * i.e. the smallest boundary on or after it. Every statement therefore lands
 * in exactly one fortnight, so an off-cycle period end is displayed and
 * flagged rather than dropped from every view at once.
 */
export function bucketEndFor(periodEndIso: string): string {
  return addDays(FORTNIGHT_ANCHOR, Math.ceil(daysFromAnchor(periodEndIso) / CYCLE) * CYCLE)
}
