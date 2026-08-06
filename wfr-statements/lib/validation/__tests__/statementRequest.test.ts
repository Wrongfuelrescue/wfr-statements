import { describe, it, expect } from 'vitest'
import {
  validatePeriodStart,
  validatePeriodEnd,
  validateMonth,
  validateFortnightlyDays,
  validateReimbursement,
  MAX_ADDITIONAL_LABOUR_HOURS_PER_DAY,
  MAX_REIMBURSEMENT_AMOUNT_PER_FORTNIGHT,
} from '../statementRequest'
import type { DayEntry } from '@/lib/calc/types'

function day(overrides: Partial<DayEntry> = {}): DayEntry {
  return {
    date: '2026-07-21',
    shift: 'none',
    adjustedHours: 0,
    additionalLabourHours: 0,
    service: 'none',
    ...overrides,
  }
}

describe('validatePeriodStart', () => {
  it('accepts a well-formed ISO date', () => {
    expect(validatePeriodStart('2026-07-21')).toBe('2026-07-21')
  })

  it('rejects undefined without touching date helpers', () => {
    expect(() => validatePeriodStart(undefined)).toThrow(/does not look right/)
  })

  it('rejects a non-date string', () => {
    expect(() => validatePeriodStart('not-a-date')).toThrow(/does not look right/)
  })

  it('rejects a month-shaped string', () => {
    expect(() => validatePeriodStart('2026-07')).toThrow(/does not look right/)
  })
})

describe('validateMonth', () => {
  it('accepts a well-formed yyyy-mm string', () => {
    expect(validateMonth('2026-07')).toBe('2026-07')
  })

  it('rejects undefined without touching date helpers', () => {
    expect(() => validateMonth(undefined)).toThrow(/does not look right/)
  })

  it('rejects a full ISO date instead of a month', () => {
    expect(() => validateMonth('2026-07-21')).toThrow(/does not look right/)
  })
})

describe('validateFortnightlyDays', () => {
  const periodStart = '2026-07-21' // fortnight runs 2026-07-21 .. 2026-08-03

  it('accepts days within the fortnight', () => {
    expect(() =>
      validateFortnightlyDays([day({ date: '2026-07-21' }), day({ date: '2026-08-03' })], periodStart),
    ).not.toThrow()
  })

  it('rejects a day before the period start', () => {
    expect(() => validateFortnightlyDays([day({ date: '2026-07-20' })], periodStart)).toThrow(
      /outside the selected fortnight/,
    )
  })

  it('rejects a day after the period end', () => {
    expect(() => validateFortnightlyDays([day({ date: '2026-08-04' })], periodStart)).toThrow(
      /outside the selected fortnight/,
    )
  })

  it('rejects a duplicate date', () => {
    expect(() =>
      validateFortnightlyDays([day({ date: '2026-07-21' }), day({ date: '2026-07-21' })], periodStart),
    ).toThrow(/more than once/)
  })

  it('rejects a malformed date on a day entry', () => {
    expect(() =>
      // @ts-expect-error deliberately malformed to prove the runtime guard
      validateFortnightlyDays([day({ date: 12345 })], periodStart),
    ).toThrow(/does not look right/)
  })

  it('accepts additional labour hours at the daily ceiling', () => {
    expect(() =>
      validateFortnightlyDays(
        [day({ additionalLabourHours: MAX_ADDITIONAL_LABOUR_HOURS_PER_DAY })],
        periodStart,
      ),
    ).not.toThrow()
  })

  it('rejects additional labour hours over the daily ceiling', () => {
    expect(() =>
      validateFortnightlyDays(
        [day({ additionalLabourHours: MAX_ADDITIONAL_LABOUR_HOURS_PER_DAY + 0.01 })],
        periodStart,
      ),
    ).toThrow(/cannot exceed/)
  })

  it('rejects a day claiming more than 24 adjusted hours', () => {
    expect(() =>
      validateFortnightlyDays(
        [day({ shift: 'adjusted', adjustedHours: MAX_ADDITIONAL_LABOUR_HOURS_PER_DAY + 0.01 })],
        periodStart,
      ),
    ).toThrow(/cannot exceed/)
  })

  it('rejects NaN adjusted hours rather than letting it reach calculateFortnightly', () => {
    // NaN is typeof 'number', so it slips past a bare > MAX_HOURS comparison
    // (NaN > x is always false) unless checked explicitly with
    // Number.isFinite.
    expect(() =>
      validateFortnightlyDays([day({ shift: 'adjusted', adjustedHours: NaN })], periodStart),
    ).toThrow(/valid number/i)
  })

})

describe('validatePeriodEnd', () => {
  it('accepts an ISO date', () => {
    expect(validatePeriodEnd('2026-08-03')).toBe('2026-08-03')
  })

  it('rejects a malformed date without leaking an internal message', () => {
    expect(() => validatePeriodEnd('3rd August')).toThrow(/fortnight ending date/i)
    expect(() => validatePeriodEnd(undefined)).toThrow(/fortnight ending date/i)
    expect(() => validatePeriodEnd({})).toThrow(/fortnight ending date/i)
  })
})

describe('validateReimbursement', () => {
  it('accepts a well-formed reimbursement', () => {
    expect(validateReimbursement({ amount: 45, description: 'Car wash' })).toEqual({
      amount: 45,
      description: 'Car wash',
    })
  })

  it('defaults a missing reimbursement to nothing claimed', () => {
    expect(validateReimbursement(undefined)).toEqual({ amount: 0, description: '' })
  })

  it('rejects a non-numeric amount', () => {
    expect(() => validateReimbursement({ amount: 'lots', description: 'x' })).toThrow()
  })

  it('rejects an amount above the ceiling', () => {
    expect(() =>
      validateReimbursement({ amount: 10_001, description: 'x' }),
    ).toThrow(/10,000/)
  })
})

describe('validateReimbursement', () => {
  it('accepts a reimbursement amount at the ceiling', () => {
    expect(() =>
      validateReimbursement({ amount: MAX_REIMBURSEMENT_AMOUNT_PER_FORTNIGHT, description: 'Parts' }),
    ).not.toThrow()
  })

  it('rejects a reimbursement amount over the ceiling', () => {
    expect(() =>
      validateReimbursement({
        amount: MAX_REIMBURSEMENT_AMOUNT_PER_FORTNIGHT + 0.01,
        description: 'Parts',
      }),
    ).toThrow(/limit/)
  })
})
