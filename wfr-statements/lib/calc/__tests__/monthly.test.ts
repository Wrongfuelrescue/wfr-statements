import { describe, it, expect } from 'vitest'
import { calculateMonthly } from '../monthly'
import type { BonusEntry } from '../types'
import type { RateCard } from '@/lib/rates/types'

const rates: RateCard = {
  contractorId: 'rec36VBHdVAy4XyuY',
  name: 'HARLEY GATT',
  abn: '',
  address: '',
  bankAccount: '',
  bankBsb: '',
  standardDayHours: 11,
  van: 'MEL VAN 2',
  city: 'MEL',
  shiftPattern: 'Week on / Week off',
  gstRegistered: true,
  baseShift: 425,
  additionalLabour: 77.27,
  rosteredDayOff: 525,
  minorService: null,
  majorService: null,
  googleReviewBonus: 15,
  fuelFilter30: 30,
  fuelFilter70: 70,
}

function bonus(over: Partial<BonusEntry> = {}): BonusEntry {
  return { googleReviews: 0, fuelFilter30: 0, fuelFilter70: 0, note: '', ...over }
}

describe('calculateMonthly', () => {
  it('produces no lines for a month with no bonuses', () => {
    const totals = calculateMonthly(bonus(), rates)
    expect(totals.lines).toHaveLength(0)
    expect(totals.total).toBe(0)
  })

  it('charges Google review bonuses at count times rate', () => {
    const totals = calculateMonthly(bonus({ googleReviews: 4 }), rates)
    expect(totals.lines[0]).toMatchObject({
      date: null,
      lineType: 'Google Review Bonus',
      quantity: 4,
      unitRate: 15,
      amount: 60,
      // Bonuses attract GST like any other earnings line.
      gstBearing: true,
    })
  })

  it('charges both fuel filter tiers separately', () => {
    const totals = calculateMonthly(bonus({ fuelFilter30: 3, fuelFilter70: 2 }), rates)
    expect(totals.lines).toHaveLength(2)
    expect(totals.lines[0]).toMatchObject({
      lineType: 'Fuel Filter Sales Bonus $30',
      quantity: 3,
      unitRate: 30,
      amount: 90,
    })
    expect(totals.lines[1]).toMatchObject({
      lineType: 'Fuel Filter Sales Bonus $70',
      quantity: 2,
      unitRate: 70,
      amount: 140,
    })
  })

  it('treats bonus lines as GST-bearing earnings, not pass-through expenses', () => {
    // Bonuses are earnings, not pass-through expenses — they must land in
    // the work subtotal, not reimbursements, and they attract GST.
    const totals = calculateMonthly(
      bonus({ googleReviews: 1, fuelFilter30: 1, fuelFilter70: 1 }),
      rates,
    )
    expect(totals.lines.every((l) => l.gstBearing)).toBe(true)
    expect(totals.reimbursements).toBe(0)
    expect(totals.workSubtotal).toBe(15 + 30 + 70)
  })

  it('charges GST for a bonus statement when the contractor is registered', () => {
    const totals = calculateMonthly(bonus({ googleReviews: 4, fuelFilter70: 2 }), rates)
    // 60 + 140 = 200
    expect(totals.workSubtotal).toBe(200)
    expect(totals.gstBase).toBe(200)
    expect(totals.gst).toBe(20)
    expect(totals.total).toBe(220)
  })

  it('omits GST for an unregistered contractor too', () => {
    const totals = calculateMonthly(bonus({ googleReviews: 4 }), {
      ...rates,
      gstRegistered: false,
    })
    expect(totals.gst).toBe(0)
    expect(totals.total).toBe(60)
  })

  it('surfaces the note as a statement-level remark, not glued to a line description', () => {
    // A prior implementation attached bonus.note to lines[0].description,
    // which read oddly when the note was about something unrelated to
    // whichever line happened to be first (e.g. fuel filters, when the
    // first line is a Google Review Bonus).
    const totals = calculateMonthly(
      bonus({ googleReviews: 2, note: 'Reviews from the Tullamarine job' }),
      rates,
    )
    expect(totals.note).toBe('Reviews from the Tullamarine job')
    expect(totals.lines[0].description).toBe('')
  })

  it('trims whitespace from the note and treats a blank note as no note', () => {
    expect(calculateMonthly(bonus({ googleReviews: 1, note: '  ' }), rates).note).toBeNull()
    expect(
      calculateMonthly(bonus({ googleReviews: 1, note: '  Trimmed  ' }), rates).note,
    ).toBe('Trimmed')
  })

  it('carries the note even when there are no bonus lines to attach it to', () => {
    const totals = calculateMonthly(bonus({ note: 'No bonuses this month, just a note' }), rates)
    expect(totals.lines).toHaveLength(0)
    expect(totals.note).toBe('No bonuses this month, just a note')
  })

  it('omits zero-count lines entirely', () => {
    const totals = calculateMonthly(bonus({ googleReviews: 2 }), rates)
    expect(totals.lines).toHaveLength(1)
  })

  it('rejects negative counts', () => {
    expect(() => calculateMonthly(bonus({ googleReviews: -1 }), rates)).toThrow(/negative/i)
    expect(() => calculateMonthly(bonus({ fuelFilter30: -1 }), rates)).toThrow(/negative/i)
    expect(() => calculateMonthly(bonus({ fuelFilter70: -1 }), rates)).toThrow(/negative/i)
  })

  it('rejects fractional counts', () => {
    expect(() => calculateMonthly(bonus({ googleReviews: 1.5 }), rates)).toThrow(
      /whole number/i,
    )
  })

  it('adds GST to bonuses for a registered contractor', () => {
    const totals = calculateMonthly(
      { googleReviews: 2, fuelFilter30: 1, fuelFilter70: 0, note: '' },
      { ...rates, gstRegistered: true, googleReviewBonus: 20, fuelFilter30: 30 },
    )
    expect(totals.workSubtotal).toBe(70)
    expect(totals.gstBase).toBe(70)
    expect(totals.gst).toBe(7)
    expect(totals.total).toBe(77)
  })

  it('adds no GST to bonuses for a contractor who is not registered', () => {
    const totals = calculateMonthly(
      { googleReviews: 2, fuelFilter30: 1, fuelFilter70: 0, note: '' },
      { ...rates, gstRegistered: false, googleReviewBonus: 20, fuelFilter30: 30 },
    )
    expect(totals.gst).toBe(0)
    expect(totals.total).toBe(70)
  })
})
