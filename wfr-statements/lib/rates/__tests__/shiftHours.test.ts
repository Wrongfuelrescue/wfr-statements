import { describe, it, expect } from 'vitest'
import { standardDayHours } from '../shiftHours'

describe('standardDayHours', () => {
  it('is 11 hours for week on / week off', () => {
    expect(standardDayHours('Week on / Week off')).toBe(11)
  })

  it('is 8.5 hours for Monday - Friday', () => {
    expect(standardDayHours('Monday - Friday')).toBe(8.5)
  })

  it('tolerates surrounding whitespace and case', () => {
    expect(standardDayHours('  week on / week off  ')).toBe(11)
    expect(standardDayHours('MONDAY - FRIDAY')).toBe(8.5)
  })

  it('returns null for an unknown pattern rather than guessing', () => {
    expect(standardDayHours('Rotating roster')).toBeNull()
  })

  it('returns null for a blank pattern', () => {
    expect(standardDayHours('')).toBeNull()
  })
})
