export const GST_RATE = 0.1

/**
 * Round to cents. Uses the epsilon nudge so values like 0.1 + 0.2 land on 0.30
 * rather than 0.30000000000000004.
 */
export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}
