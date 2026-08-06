/**
 * The sale price at which each fuel filter bonus is earned. Fixed business
 * rules that apply to every contractor — unlike the bonus amounts
 * themselves, which are per-contractor rates in INVOICE MATRIX. Shown on the
 * monthly form so a contractor picks the right bonus by the price the filter
 * actually sold at.
 */
export const FUEL_FILTER_SALE_PRICE_30 = 79.5
export const FUEL_FILTER_SALE_PRICE_70 = 149

/**
 * `$149`, not `$149.00` — the price is quoted to contractors the way it is
 * written on the price list. Cents are shown only when there are any.
 */
export function formatSalePrice(price: number): string {
  return Number.isInteger(price) ? `$${price}` : `$${price.toFixed(2)}`
}
