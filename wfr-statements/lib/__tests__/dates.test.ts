import { describe, it, expect } from 'vitest'
import {
  addDays,
  fortnightDates,
  fortnightDatesEndingOn,
  fortnightStartFromEnd,
  formatDisplayDate,
  formatDisplayDateWithYear,
  monthRange,
  mostRecentMonday,
  mostRecentSunday,
  perthDateFromInstant,
} from '../dates'

describe('mostRecentMonday', () => {
  it('returns the same day when today is Monday', () => {
    expect(mostRecentMonday(new Date('2026-08-03T12:00:00Z'))).toBe('2026-08-03')
  })

  it('returns the previous Monday mid-week', () => {
    // 2026-08-05 is a Wednesday
    expect(mostRecentMonday(new Date('2026-08-05T12:00:00Z'))).toBe('2026-08-03')
  })

  it('returns the previous Monday on a Sunday', () => {
    // 2026-08-09 is a Sunday
    expect(mostRecentMonday(new Date('2026-08-09T12:00:00Z'))).toBe('2026-08-03')
  })
})

describe('addDays', () => {
  it('adds days within a month', () => {
    expect(addDays('2026-07-21', 3)).toBe('2026-07-24')
  })

  it('rolls over a month boundary', () => {
    expect(addDays('2026-07-31', 1)).toBe('2026-08-01')
  })

  it('rolls over a year boundary', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('handles a leap day', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })
})

describe('fortnightDates', () => {
  it('returns exactly fourteen dates', () => {
    expect(fortnightDates('2026-07-21')).toHaveLength(14)
  })

  it('starts on the given date and ends thirteen days later', () => {
    const dates = fortnightDates('2026-07-21')
    expect(dates[0]).toBe('2026-07-21')
    expect(dates[13]).toBe('2026-08-03')
  })

  it('crosses a month boundary correctly', () => {
    expect(fortnightDates('2026-07-25')[13]).toBe('2026-08-07')
  })
})

describe('formatDisplayDate', () => {
  it('formats as short weekday, day and month', () => {
    expect(formatDisplayDate('2026-07-21')).toBe('Tue 21 Jul')
  })

  it('does not pad a single-digit day', () => {
    expect(formatDisplayDate('2026-08-03')).toBe('Mon 3 Aug')
  })

  it('formats the first day of the year', () => {
    expect(formatDisplayDate('2026-01-01')).toBe('Thu 1 Jan')
  })

  it('formats the last day of the year', () => {
    expect(formatDisplayDate('2026-12-31')).toBe('Thu 31 Dec')
  })

  it('formats a leap day', () => {
    expect(formatDisplayDate('2028-02-29')).toBe('Tue 29 Feb')
  })
})

describe('formatDisplayDateWithYear', () => {
  it('formats as short weekday, day, month and year', () => {
    expect(formatDisplayDateWithYear('2026-07-21')).toBe('Tue 21 Jul 2026')
  })

  it('does not pad a single-digit day', () => {
    expect(formatDisplayDateWithYear('2026-08-03')).toBe('Mon 3 Aug 2026')
  })

  it('distinguishes the same fortnight a year apart', () => {
    expect(formatDisplayDateWithYear('2026-08-04')).not.toBe(
      formatDisplayDateWithYear('2027-08-04'),
    )
  })

  it('shows the correct year either side of a year boundary', () => {
    expect(formatDisplayDateWithYear('2026-12-31')).toBe('Thu 31 Dec 2026')
    expect(formatDisplayDateWithYear('2027-01-01')).toBe('Fri 1 Jan 2027')
  })

  it('formats a leap day', () => {
    expect(formatDisplayDateWithYear('2028-02-29')).toBe('Tue 29 Feb 2028')
  })
})

describe('monthRange', () => {
  it('returns the first and last day of a 31-day month', () => {
    expect(monthRange('2026-07')).toEqual({ start: '2026-07-01', end: '2026-07-31' })
  })

  it('returns the first and last day of a 30-day month', () => {
    expect(monthRange('2026-06')).toEqual({ start: '2026-06-01', end: '2026-06-30' })
  })

  it('handles February in a leap year', () => {
    expect(monthRange('2028-02')).toEqual({ start: '2028-02-01', end: '2028-02-29' })
  })
})

describe('mostRecentSunday', () => {
  it('returns the same day when today is Sunday', () => {
    // 2026-08-09 is a Sunday
    expect(mostRecentSunday(new Date('2026-08-09T12:00:00Z'))).toBe('2026-08-09')
  })

  it('returns the previous Sunday mid-week', () => {
    // 2026-08-05 is a Wednesday
    expect(mostRecentSunday(new Date('2026-08-05T12:00:00Z'))).toBe('2026-08-02')
  })

  it('returns the previous Sunday on a Saturday', () => {
    // 2026-08-08 is a Saturday
    expect(mostRecentSunday(new Date('2026-08-08T12:00:00Z'))).toBe('2026-08-02')
  })
})

describe('fortnightStartFromEnd', () => {
  it('counts back thirteen days so the period is fourteen days inclusive', () => {
    expect(fortnightStartFromEnd('2026-08-03')).toBe('2026-07-21')
  })

  it('crosses a month boundary', () => {
    expect(fortnightStartFromEnd('2026-08-07')).toBe('2026-07-25')
  })

  it('crosses a year boundary', () => {
    expect(fortnightStartFromEnd('2027-01-05')).toBe('2026-12-23')
  })
})

describe('perthDateFromInstant', () => {
  it('returns the next calendar date when a UTC instant is already tomorrow in Perth (UTC+8)', () => {
    // 7am AEST (UTC+10) on 1 September is 2026-08-31T21:00Z. Perth is
    // UTC+8, with no daylight saving, so the Perth wall-clock time is
    // 2026-09-01T05:00 — 1 September, not 31 August.
    expect(perthDateFromInstant('2026-08-31T21:00:00.000Z')).toBe('2026-09-01')
  })

  it('leaves a UTC instant unchanged when adding 8 hours does not cross midnight', () => {
    expect(perthDateFromInstant('2026-08-04T02:00:00.000Z')).toBe('2026-08-04')
  })

  it('crosses a month boundary correctly', () => {
    expect(perthDateFromInstant('2026-07-31T20:00:00.000Z')).toBe('2026-08-01')
  })
})

describe('fortnightDatesEndingOn', () => {
  it('returns exactly fourteen dates', () => {
    expect(fortnightDatesEndingOn('2026-08-03')).toHaveLength(14)
  })

  it('starts thirteen days before the end date and finishes on it', () => {
    const dates = fortnightDatesEndingOn('2026-08-03')
    expect(dates[0]).toBe('2026-07-21')
    expect(dates[13]).toBe('2026-08-03')
  })

  it('matches the equivalent fortnight built from its start date', () => {
    expect(fortnightDatesEndingOn('2026-08-03')).toEqual(fortnightDates('2026-07-21'))
  })
})
