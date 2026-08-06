/**
 * Formatted explicitly rather than via toLocaleString, for the same reason
 * lib/dates.ts formats dates by hand: ICU output varies by host build, and
 * these figures back real payment decisions.
 */
export function formatMoney(amount: number): string {
  const [whole, decimals] = Math.abs(amount).toFixed(2).split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${amount < 0 ? '-' : ''}$${grouped}.${decimals}`
}

/** A 0–1 share as a whole-number percentage. */
export function formatPercent(share: number): string {
  return `${Math.round(share * 100)}%`
}
