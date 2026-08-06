import { describe, it, expect } from 'vitest'
import { gstNote, subtotalLabel, NOT_REGISTERED_NOTE } from '../notes'
import { rollUpTotals } from '../totals'
import type { StatementLine } from '../types'

function line(over: Partial<StatementLine> = {}): StatementLine {
  return {
    date: '2026-07-21',
    lineType: 'Sub Contractor Labour Hire',
    quantity: 1,
    unitRate: 425,
    amount: 425,
    description: '',
    gstBearing: true,
    ...over,
  }
}

describe('gstNote', () => {
  it('shows no note on a fortnightly statement, where every earnings line is GST-bearing', () => {
    const totals = rollUpTotals([line({ amount: 425 })], true)
    expect(gstNote(totals)).toBeNull()
  })

  it('shows only the not-registered note for an unregistered contractor, even with a bonus line', () => {
    const totals = rollUpTotals(
      [line({ lineType: 'Google Review Bonus', amount: 60, gstBearing: false })],
      false,
    )
    expect(gstNote(totals)).toBe(NOT_REGISTERED_NOTE)
  })

  it('shows no note for an unregistered contractor with an all-GST-bearing line set', () => {
    const totals = rollUpTotals([line({ amount: 425 })], false)
    expect(gstNote(totals)).toBe(NOT_REGISTERED_NOTE)
  })

  it('shows no note for a registered contractor with an empty statement', () => {
    const totals = rollUpTotals([], true)
    expect(gstNote(totals)).toBeNull()
  })

  it('shows no note when a registered contractor claims only bonuses', () => {
    const totals = rollUpTotals(
      [
        {
          date: null,
          lineType: 'Google Review Bonus',
          quantity: 1,
          unitRate: 20,
          amount: 20,
          description: '',
          gstBearing: true,
        },
      ],
      true,
    )
    expect(gstNote(totals)).toBeNull()
  })
})

describe('subtotalLabel', () => {
  it('labels a fortnightly statement "Work subtotal"', () => {
    const totals = rollUpTotals([line({ amount: 425 })], true)
    expect(subtotalLabel(totals)).toBe('Work subtotal')
  })

  it('labels a bonus-only statement "Subtotal (bonuses)"', () => {
    const totals = rollUpTotals(
      [line({ lineType: 'Google Review Bonus', amount: 60, gstBearing: false })],
      true,
    )
    expect(subtotalLabel(totals)).toBe('Subtotal (bonuses)')
  })

  it('labels a mixed statement with any non-bonus earnings line "Work subtotal"', () => {
    const totals = rollUpTotals(
      [
        line({ amount: 425 }),
        line({ lineType: 'Google Review Bonus', amount: 60, gstBearing: false }),
      ],
      true,
    )
    expect(subtotalLabel(totals)).toBe('Work subtotal')
  })

  it('labels an empty statement "Work subtotal" by default', () => {
    expect(subtotalLabel(rollUpTotals([], true))).toBe('Work subtotal')
  })

  it('labels a bonus statement with multiple bonus types "Subtotal (bonuses)"', () => {
    const totals = rollUpTotals(
      [
        line({ lineType: 'Fuel Filter Sales Bonus $30', amount: 90, gstBearing: false }),
        line({ lineType: 'Fuel Filter Sales Bonus $70', amount: 140, gstBearing: false }),
      ],
      true,
    )
    expect(subtotalLabel(totals)).toBe('Subtotal (bonuses)')
  })
})
