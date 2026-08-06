import { describe, it, expect } from 'vitest'
import { WFR_PAYEE, invoiceHeading } from '../payee'

describe('WFR_PAYEE', () => {
  it('carries the registered entity name', () => {
    expect(WFR_PAYEE.name).toBe('Wrong Fuel Rescue Pty Ltd')
  })

  it('carries a checksum-valid ABN', () => {
    const digits = WFR_PAYEE.abn.replace(/\s/g, '').split('').map(Number)
    digits[0] -= 1
    const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19]
    const sum = digits.reduce((s, d, i) => s + d * weights[i], 0)
    expect(sum % 89).toBe(0)
  })

  it('carries the business address as separate lines', () => {
    expect(WFR_PAYEE.addressLines).toEqual([
      '7 Southport Street',
      'West Leederville',
      'WA 6007',
    ])
  })
})

describe('invoiceHeading', () => {
  it('is a tax invoice for a GST-registered contractor', () => {
    expect(invoiceHeading(true)).toBe('TAX INVOICE')
  })

  it('is a plain invoice for a contractor who is not registered', () => {
    // A contractor not registered for GST must not issue a document headed
    // "Tax invoice" — it would misrepresent that GST was charged.
    expect(invoiceHeading(false)).toBe('INVOICE')
  })
})
