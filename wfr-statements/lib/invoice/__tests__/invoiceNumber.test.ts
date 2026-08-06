import { describe, expect, it } from 'vitest'
import { suggestInvoiceNumber, validateInvoiceNumber } from '../invoiceNumber'

describe('suggestInvoiceNumber', () => {
  it('suggests a number derived from the period ending date', () => {
    expect(suggestInvoiceNumber('2026-07-26')).toBe('WFR-20260726')
  })
})

describe('validateInvoiceNumber', () => {
  it('accepts and trims what the contractor typed', () => {
    expect(validateInvoiceNumber('  INV-001  ')).toBe('INV-001')
  })

  it('rejects a blank number', () => {
    expect(() => validateInvoiceNumber('   ')).toThrow(/invoice number/i)
  })

  it('rejects a missing or non-string number', () => {
    expect(() => validateInvoiceNumber(undefined)).toThrow(/invoice number/i)
    expect(() => validateInvoiceNumber(42)).toThrow(/invoice number/i)
  })

  it('rejects an absurdly long number', () => {
    expect(() => validateInvoiceNumber('X'.repeat(41))).toThrow(/40 characters/)
  })

  it('rejects control characters, which would corrupt the printed invoice', () => {
    expect(() => validateInvoiceNumber('INV\n001')).toThrow(/invoice number/i)
  })
})
