import { describe, it, expect } from 'vitest'
import { parseRate, RateParseError } from '../parse'

describe('parseRate', () => {
  it('parses a whole-number rate', () => {
    expect(parseRate('425', 'Base Shift Rate')).toBe(425)
  })

  it('parses a decimal rate', () => {
    expect(parseRate('77.27', 'Additional Labour')).toBe(77.27)
  })

  it('tolerates currency symbols, commas and whitespace', () => {
    expect(parseRate(' $1,425.50 ', 'Base Shift Rate')).toBe(1425.5)
  })

  it('returns null for N/A regardless of case or spacing', () => {
    expect(parseRate('N/A', 'Minor Vehicle Service')).toBeNull()
    expect(parseRate('n/a', 'Minor Vehicle Service')).toBeNull()
    expect(parseRate(' N/A ', 'Minor Vehicle Service')).toBeNull()
    expect(parseRate('NA', 'Minor Vehicle Service')).toBeNull()
  })

  it('returns null for blank, null and undefined', () => {
    expect(parseRate('', 'Reimbursements')).toBeNull()
    expect(parseRate(null, 'Reimbursements')).toBeNull()
    expect(parseRate(undefined, 'Reimbursements')).toBeNull()
  })

  it('throws on unparseable text rather than returning zero', () => {
    expect(() => parseRate('four hundred', 'Base Shift Rate')).toThrow(RateParseError)
  })

  it('throws on a negative rate', () => {
    expect(() => parseRate('-425', 'Base Shift Rate')).toThrow(RateParseError)
  })

  it('throws on a zero rate', () => {
    expect(() => parseRate('0', 'Base Shift Rate')).toThrow(RateParseError)
  })

  it('names the offending field on the error', () => {
    try {
      parseRate('oops', 'Rostered Day-off shift')
      throw new Error('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(RateParseError)
      expect((e as RateParseError).fieldLabel).toBe('Rostered Day-off shift')
      expect((e as RateParseError).message).toContain('Rostered Day-off shift')
    }
  })

  it('throws on a value with an internal space rather than silently collapsing it', () => {
    // "42 5" is a plausible typo for "42.5" — it must not become 425.
    expect(() => parseRate('42 5', 'Base Shift Rate')).toThrow(RateParseError)
  })

  it('throws on a space used as a thousands separator', () => {
    expect(() => parseRate('1 425', 'Base Shift Rate')).toThrow(RateParseError)
  })

  it('throws on scientific notation', () => {
    expect(() => parseRate('1e3', 'Base Shift Rate')).toThrow(RateParseError)
  })

  it('still accepts a leading dollar sign and thousands commas', () => {
    expect(parseRate('$1,425.50', 'Base Shift Rate')).toBe(1425.5)
  })
})
