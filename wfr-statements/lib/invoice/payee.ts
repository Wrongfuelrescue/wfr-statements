/**
 * WFR's own details, as the party being invoiced.
 *
 * A constant rather than environment variables: these are stable, non-secret
 * business details, identical in every environment — which is what environment
 * variables are not for. As a constant they are version-controlled, visible in
 * review, and cannot go missing; an unset variable would render an invoice with
 * no payee at all.
 *
 * ABN checksum verified: weighted sum 445, divisible by 89.
 */
export const WFR_PAYEE = {
  name: 'Wrong Fuel Rescue Pty Ltd',
  addressLines: ['7 Southport Street', 'West Leederville', 'WA 6007'],
  abn: '82 603 782 234',
} as const

/**
 * A contractor who is not registered for GST must not issue a document headed
 * "Tax invoice" — that would represent that GST had been charged when it has
 * not. Their document is a plain invoice.
 */
export function invoiceHeading(gstRegistered: boolean): string {
  return gstRegistered ? 'TAX INVOICE' : 'INVOICE'
}
