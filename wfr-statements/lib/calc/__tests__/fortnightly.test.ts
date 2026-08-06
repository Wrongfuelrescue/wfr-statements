import { describe, it, expect } from 'vitest'
import { calculateFortnightly, ClaimNotPermittedError } from '../fortnightly'
import { roundMoney } from '../money'
import type { DayEntry } from '../types'
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
  minorService: 77.27,
  majorService: 115.91,
  googleReviewBonus: 15,
  fuelFilter30: 30,
  fuelFilter70: 70,
}

const NO_REIMBURSEMENT = { amount: 0, description: '' }

function day(over: Partial<DayEntry> = {}): DayEntry {
  return {
    date: '2026-07-21',
    shift: 'none',
    adjustedHours: 0,
    additionalLabourHours: 0,
    service: 'none',
    ...over,
  }
}

describe('calculateFortnightly', () => {
  it('produces no lines for a fortnight of no work', () => {
    const totals = calculateFortnightly(
      [day(), day({ date: '2026-07-22' })],
      NO_REIMBURSEMENT,
      rates,
    )
    expect(totals.lines).toHaveLength(0)
    expect(totals.total).toBe(0)
  })

  it('charges a base shift at the base rate', () => {
    const totals = calculateFortnightly([day({ shift: 'base' })], NO_REIMBURSEMENT, rates)
    expect(totals.lines).toHaveLength(1)
    expect(totals.lines[0]).toMatchObject({
      date: '2026-07-21',
      lineType: 'Sub Contractor Labour Hire',
      quantity: 1,
      unitRate: 425,
      amount: 425,
      gstBearing: true,
    })
  })

  it('charges a rostered day-off shift at the RDO rate', () => {
    const totals = calculateFortnightly([day({ shift: 'rdo' })], NO_REIMBURSEMENT, rates)
    expect(totals.lines[0]).toMatchObject({
      lineType: 'Sub Contractor Labour Hire – RDA Rate',
      unitRate: 525,
      amount: 525,
    })
  })

  it('charges additional labour as hours times the hourly rate', () => {
    const totals = calculateFortnightly(
      [day({ additionalLabourHours: 2 })],
      NO_REIMBURSEMENT,
      rates,
    )
    expect(totals.lines[0]).toMatchObject({
      lineType: 'Sub Contractor Labour Hire – Additional Hours',
      quantity: 2,
      unitRate: 77.27,
      amount: 154.54,
    })
  })

  it('handles fractional labour hours', () => {
    const totals = calculateFortnightly(
      [day({ additionalLabourHours: 1.5 })],
      NO_REIMBURSEMENT,
      rates,
    )
    expect(totals.lines[0].amount).toBe(115.91)
  })

  it('charges minor and major servicing at their flat rates', () => {
    const minor = calculateFortnightly([day({ service: 'minor' })], NO_REIMBURSEMENT, rates)
    expect(minor.lines[0]).toMatchObject({ lineType: 'Minor Service', amount: 77.27 })

    const major = calculateFortnightly([day({ service: 'major' })], NO_REIMBURSEMENT, rates)
    expect(major.lines[0]).toMatchObject({ lineType: 'Major Service', amount: 115.91 })
  })

  it('refuses a servicing claim when the contractor has an N/A rate', () => {
    const noService: RateCard = { ...rates, minorService: null, majorService: null }
    expect(() =>
      calculateFortnightly([day({ service: 'minor' })], NO_REIMBURSEMENT, noService),
    ).toThrow(ClaimNotPermittedError)
    expect(() =>
      calculateFortnightly([day({ service: 'major' })], NO_REIMBURSEMENT, noService),
    ).toThrow(ClaimNotPermittedError)
  })

  it('emits multiple lines for a day carrying several claim types', () => {
    const totals = calculateFortnightly(
      [day({ shift: 'base', additionalLabourHours: 2, service: 'minor' })],
      NO_REIMBURSEMENT,
      rates,
    )
    expect(totals.lines.map((l) => l.lineType)).toEqual([
      'Sub Contractor Labour Hire',
      'Sub Contractor Labour Hire – Additional Hours',
      'Minor Service',
    ])
  })

  it('totals a realistic fortnight with GST and a reimbursement', () => {
    const totals = calculateFortnightly(
      [
        day({ date: '2026-07-21', shift: 'base', additionalLabourHours: 2 }),
        day({ date: '2026-07-22', shift: 'base' }),
        day({ date: '2026-07-24', shift: 'rdo' }),
        day({ date: '2026-07-25', shift: 'base', service: 'minor' }),
        day({ date: '2026-07-26' }),
      ],
      { amount: 45, description: 'Fuel' },
      rates,
    )
    // Work: 425 + 154.54 + 425 + 525 + 425 + 77.27 = 2031.81
    expect(totals.workSubtotal).toBe(2031.81)
    expect(totals.gst).toBe(203.18)
    expect(totals.reimbursements).toBe(45)
    expect(totals.total).toBe(2279.99)
    // On a fortnightly statement every earnings line is GST-bearing, so
    // gstBase must equal workSubtotal — this task must not change that.
    expect(totals.gstBase).toBe(totals.workSubtotal)
  })

  it('omits GST for an unregistered contractor but keeps reimbursements', () => {
    const totals = calculateFortnightly(
      [day({ shift: 'base' })],
      { amount: 45, description: 'Fuel' },
      { ...rates, gstRegistered: false },
    )
    expect(totals.gst).toBe(0)
    expect(totals.total).toBe(470)
  })

  it('keeps lines in date order', () => {
    const totals = calculateFortnightly(
      [
        day({ date: '2026-07-23', shift: 'base' }),
        day({ date: '2026-07-21', shift: 'base' }),
      ],
      NO_REIMBURSEMENT,
      rates,
    )
    expect(totals.lines.map((l) => l.date)).toEqual(['2026-07-21', '2026-07-23'])
  })

  it('rejects negative labour hours', () => {
    expect(() =>
      calculateFortnightly([day({ additionalLabourHours: -1 })], NO_REIMBURSEMENT, rates),
    ).toThrow(/negative/i)
  })

  it('rounds unitRate so quantity x unitRate reconciles with amount on every line', () => {
    // A rate carrying more than two decimals must not print unrounded on a
    // statement line — a contractor checks qty x rate = amount by eye.
    const oddRates: RateCard = {
      ...rates,
      baseShift: 425.004,
      additionalLabour: 77.273,
      rosteredDayOff: 525.006,
      minorService: 77.273,
      majorService: 115.914,
    }
    const totals = calculateFortnightly(
      [
        day({ date: '2026-07-21', shift: 'base', additionalLabourHours: 1, service: 'minor' }),
        day({ date: '2026-07-22', shift: 'rdo', service: 'major' }),
      ],
      NO_REIMBURSEMENT,
      oddRates,
    )
    for (const line of totals.lines) {
      expect(line.unitRate).toBe(roundMoney(line.unitRate))
      expect(line.amount).toBe(roundMoney(line.quantity * line.unitRate))
    }
  })

  it('prices an adjusted shift pro-rata over an 11-hour day', () => {
    // 6.5 / 11 * 425 = 251.136... -> 251.14
    const totals = calculateFortnightly(
      [day({ shift: 'adjusted', adjustedHours: 6.5 })],
      NO_REIMBURSEMENT,
      rates,
    )
    expect(totals.lines).toHaveLength(1)
    expect(totals.lines[0]).toMatchObject({
      lineType: 'Sub Contractor Labour Hire – Adjusted Hours',
      quantity: 1,
      unitRate: 251.14,
      amount: 251.14,
      description: '6.5 of 11 hours',
      gstBearing: true,
    })
  })

  it('prices an adjusted shift pro-rata over an 8.5-hour day', () => {
    // 6.5 / 8.5 * 325 = 248.529... -> 248.53
    const totals = calculateFortnightly(
      [day({ shift: 'adjusted', adjustedHours: 6.5 })],
      NO_REIMBURSEMENT,
      { ...rates, baseShift: 325, standardDayHours: 8.5 },
    )
    expect(totals.lines[0]).toMatchObject({
      quantity: 1,
      unitRate: 248.53,
      amount: 248.53,
      description: '6.5 of 8.5 hours',
    })
  })

  it('pays a full standard day exactly the base shift rate', () => {
    const totals = calculateFortnightly(
      [day({ shift: 'adjusted', adjustedHours: 11 })],
      NO_REIMBURSEMENT,
      rates,
    )
    expect(totals.lines[0]).toMatchObject({
      quantity: 1,
      unitRate: 425,
      amount: 425,
      description: '11 of 11 hours',
    })
  })

  it('always reconciles quantity x unitRate = amount on an adjusted-shift line, even at odd rates', () => {
    // A rate that does not divide evenly (77.27 base / 6 hours) previously
    // rounded unitRate and amount independently, landing a cent apart. With
    // quantity pinned to 1 and unitRate set equal to amount, the printed line
    // always multiplies out exactly.
    const totals = calculateFortnightly(
      [day({ shift: 'adjusted', adjustedHours: 3.7 })],
      NO_REIMBURSEMENT,
      { ...rates, baseShift: 320.17, standardDayHours: 7.3 },
    )
    const line = totals.lines[0]
    expect(line.quantity).toBe(1)
    expect(line.unitRate).toBe(line.amount)
    expect(roundMoney(line.quantity * line.unitRate)).toBe(line.amount)
  })

  it('counts an adjusted shift as GST-bearing earnings, not a reimbursement', () => {
    const totals = calculateFortnightly(
      [day({ shift: 'adjusted', adjustedHours: 6.5 })],
      NO_REIMBURSEMENT,
      rates,
    )
    expect(totals.workSubtotal).toBe(251.14)
    expect(totals.gstBase).toBe(251.14)
    expect(totals.reimbursements).toBe(0)
  })

  it('rejects an adjusted shift with no hours', () => {
    expect(() =>
      calculateFortnightly([day({ shift: 'adjusted', adjustedHours: 0 })], NO_REIMBURSEMENT, rates),
    ).toThrow(/hours/i)
  })

  it('rejects an adjusted shift with undefined hours rather than producing NaN', () => {
    // undefined <= 0 is false, so a bare `<= 0` guard lets this through and
    // (undefined / 11) * 425 becomes NaN — a NaN total that still clears the
    // route's `totals.total <= 0` check (NaN <= 0 is also false), so the
    // statement would be created and persisted with a NaN amount.
    const withoutHours = day({ shift: 'adjusted' })
    // @ts-expect-error deliberately simulating a client omitting the field
    delete withoutHours.adjustedHours
    expect(() => calculateFortnightly([withoutHours], NO_REIMBURSEMENT, rates)).toThrow(/hours/i)
  })

  it('rejects an adjusted shift with NaN hours rather than producing NaN', () => {
    expect(() =>
      calculateFortnightly(
        [day({ shift: 'adjusted', adjustedHours: NaN })],
        NO_REIMBURSEMENT,
        rates,
      ),
    ).toThrow(/hours/i)
  })

  it('rejects more hours than a standard day', () => {
    expect(() =>
      calculateFortnightly(
        [day({ shift: 'adjusted', adjustedHours: 11.5 })],
        NO_REIMBURSEMENT,
        rates,
      ),
    ).toThrow(/11/)
  })

  it('refuses an adjusted shift when the contractor has no known shift length', () => {
    expect(() =>
      calculateFortnightly([day({ shift: 'adjusted', adjustedHours: 6.5 })], NO_REIMBURSEMENT, {
        ...rates,
        standardDayHours: null,
      }),
    ).toThrow(ClaimNotPermittedError)
  })

  it('still allows additional labour and a service alongside an adjusted shift', () => {
    const totals = calculateFortnightly(
      [day({ shift: 'adjusted', adjustedHours: 6.5, additionalLabourHours: 2, service: 'minor' })],
      NO_REIMBURSEMENT,
      { ...rates, minorService: 77.27 },
    )
    expect(totals.lines.map((l) => l.lineType)).toEqual([
      'Sub Contractor Labour Hire – Adjusted Hours',
      'Sub Contractor Labour Hire – Additional Hours',
      'Minor Service',
    ])
  })
})

describe('calculateFortnightly reimbursement', () => {
  it('adds a single reimbursement line that is not GST-bearing', () => {
    const totals = calculateFortnightly(
      [day({ shift: 'base' })],
      { amount: 45, description: 'Car wash and parking' },
      rates,
    )
    const line = totals.lines.find((l) => l.lineType === 'Reimbursement')
    expect(line).toMatchObject({
      date: null,
      quantity: 1,
      unitRate: 45,
      amount: 45,
      description: 'Car wash and parking',
      gstBearing: false,
    })
  })

  it('excludes the reimbursement from GST but adds it to the total', () => {
    const totals = calculateFortnightly(
      [day({ shift: 'base' })],
      { amount: 45, description: 'Car wash' },
      rates,
    )
    expect(totals.workSubtotal).toBe(425)
    expect(totals.gst).toBe(42.5)
    expect(totals.reimbursements).toBe(45)
    expect(totals.total).toBe(512.5)
  })

  it('adds no line when the amount is zero', () => {
    const totals = calculateFortnightly([day({ shift: 'base' })], NO_REIMBURSEMENT, rates)
    expect(totals.lines).toHaveLength(1)
    expect(totals.reimbursements).toBe(0)
  })

  it('rejects a negative amount', () => {
    expect(() =>
      calculateFortnightly([day()], { amount: -5, description: 'Car wash' }, rates),
    ).toThrow(/negative/i)
  })

  it('rejects an amount with no description', () => {
    expect(() =>
      calculateFortnightly([day()], { amount: 45, description: '   ' }, rates),
    ).toThrow(/description/i)
  })

  it('trims the description', () => {
    const totals = calculateFortnightly(
      [day()],
      { amount: 45, description: '  Car wash  ' },
      rates,
    )
    expect(totals.lines[0].description).toBe('Car wash')
  })

  it('places the reimbursement last, after every dated line', () => {
    const totals = calculateFortnightly(
      [day({ date: '2026-07-21', shift: 'base' }), day({ date: '2026-07-22', shift: 'base' })],
      { amount: 45, description: 'Car wash' },
      rates,
    )
    expect(totals.lines[totals.lines.length - 1].lineType).toBe('Reimbursement')
  })
})
