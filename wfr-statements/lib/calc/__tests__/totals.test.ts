import { describe, it, expect } from 'vitest'
import { roundMoney, GST_RATE } from '../money'
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

describe('roundMoney', () => {
  it('rounds to two decimal places', () => {
    expect(roundMoney(77.271)).toBe(77.27)
    expect(roundMoney(77.275)).toBe(77.28)
  })

  it('corrects floating point drift', () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3)
  })

  it('leaves whole numbers alone', () => {
    expect(roundMoney(425)).toBe(425)
  })
})

describe('GST_RATE', () => {
  it('is ten percent', () => {
    expect(GST_RATE).toBe(0.1)
  })
})

describe('rollUpTotals', () => {
  it('sums non-reimbursement lines into the work subtotal', () => {
    const totals = rollUpTotals([line({ amount: 425 }), line({ amount: 154.54 })], true)
    expect(totals.workSubtotal).toBe(579.54)
  })

  it('puts a non-GST-bearing, non-reimbursement line (a bonus) in the work subtotal, not reimbursements', () => {
    // Bucket membership is decided by lineType, not by gstBearing. A
    // performance bonus is earnings even though it does not attract GST.
    const totals = rollUpTotals(
      [line({ lineType: 'Google Review Bonus', amount: 200, gstBearing: false })],
      true,
    )
    expect(totals.workSubtotal).toBe(200)
    expect(totals.reimbursements).toBe(0)
    expect(totals.gstBase).toBe(0)
    expect(totals.gst).toBe(0)
    expect(totals.total).toBe(200)
  })

  it('computes gstBase as the sum of only GST-bearing lines, separate from workSubtotal', () => {
    const totals = rollUpTotals(
      [
        line({ lineType: 'Sub Contractor Labour Hire', amount: 425, gstBearing: true }),
        line({ lineType: 'Google Review Bonus', amount: 200, gstBearing: false }),
      ],
      true,
    )
    expect(totals.workSubtotal).toBe(625)
    expect(totals.gstBase).toBe(425)
    expect(totals.gst).toBe(42.5)
    expect(totals.total).toBe(667.5)
  })

  it('sets gstBase to workSubtotal when every earnings line is GST-bearing (the fortnightly case)', () => {
    const totals = rollUpTotals([line({ amount: 425 }), line({ amount: 154.54 })], true)
    expect(totals.gstBase).toBe(totals.workSubtotal)
  })

  it('adds 10% GST for a registered contractor', () => {
    const totals = rollUpTotals([line({ amount: 425 })], true)
    expect(totals.gst).toBe(42.5)
    expect(totals.total).toBe(467.5)
  })

  it('adds no GST for an unregistered contractor', () => {
    const totals = rollUpTotals([line({ amount: 425 })], false)
    expect(totals.gst).toBe(0)
    expect(totals.total).toBe(425)
  })

  it('excludes reimbursements from the work subtotal and from GST', () => {
    const totals = rollUpTotals(
      [
        line({ amount: 425 }),
        line({ lineType: 'Reimbursement', amount: 45, gstBearing: false, unitRate: 45 }),
      ],
      true,
    )
    expect(totals.workSubtotal).toBe(425)
    expect(totals.reimbursements).toBe(45)
    expect(totals.gst).toBe(42.5)
    // 425 + 42.50 + 45.00 — reimbursement rides above the GST calculation.
    expect(totals.total).toBe(512.5)
  })

  it('adds reimbursements to the total for an unregistered contractor too', () => {
    const totals = rollUpTotals(
      [
        line({ amount: 400 }),
        line({ lineType: 'Reimbursement', amount: 45, gstBearing: false, unitRate: 45 }),
      ],
      false,
    )
    expect(totals.workSubtotal).toBe(400)
    expect(totals.reimbursements).toBe(45)
    expect(totals.gst).toBe(0)
    expect(totals.total).toBe(445)
  })

  it('rounds GST to two decimal places', () => {
    // 77.27 * 3 = 231.81 -> GST 23.181 -> 23.18
    const totals = rollUpTotals([line({ amount: 231.81 })], true)
    expect(totals.gst).toBe(23.18)
    expect(totals.total).toBe(254.99)
  })

  it('returns zeroes for an empty line list', () => {
    const totals = rollUpTotals([], true)
    expect(totals.workSubtotal).toBe(0)
    expect(totals.gstBase).toBe(0)
    expect(totals.gst).toBe(0)
    expect(totals.reimbursements).toBe(0)
    expect(totals.total).toBe(0)
  })

  it('preserves the lines it was given', () => {
    const lines = [line()]
    expect(rollUpTotals(lines, true).lines).toEqual(lines)
  })

  it('records the GST registration status used', () => {
    expect(rollUpTotals([], false).gstRegistered).toBe(false)
    expect(rollUpTotals([], true).gstRegistered).toBe(true)
  })
})
