import { describe, expect, it } from 'vitest'
import {
  FORTNIGHT_ANCHOR,
  bucketEndFor,
  currentFortnightEnd,
  fortnightWindow,
  isOnCycle,
  stepFortnight,
} from '../fortnight'

describe('isOnCycle', () => {
  it('accepts the anchor itself', () => {
    expect(isOnCycle(FORTNIGHT_ANCHOR)).toBe(true)
  })

  it('accepts a boundary fourteen days later and earlier', () => {
    expect(isOnCycle('2026-08-16')).toBe(true)
    expect(isOnCycle('2026-07-19')).toBe(true)
  })

  it('rejects the Sunday between two boundaries', () => {
    expect(isOnCycle('2026-08-09')).toBe(false)
  })

  /** The real off-cycle case already in the base: a Monday ending. */
  it('rejects a Monday ending', () => {
    expect(isOnCycle('2026-08-03')).toBe(false)
  })

  it('works across a year boundary', () => {
    expect(isOnCycle('2027-01-31')).toBe(true)
    expect(isOnCycle('2027-02-01')).toBe(false)
  })
})

describe('fortnightWindow', () => {
  it('spans fourteen days inclusive of both ends', () => {
    expect(fortnightWindow('2026-08-02')).toEqual({ start: '2026-07-20', end: '2026-08-02' })
  })
})

describe('currentFortnightEnd', () => {
  it('returns the most recently ended fortnight, not the one in progress', () => {
    expect(currentFortnightEnd(new Date('2026-08-05T00:00:00Z'))).toBe('2026-08-02')
  })

  it('returns today when today is itself a boundary', () => {
    expect(currentFortnightEnd(new Date('2026-08-16T00:00:00Z'))).toBe('2026-08-16')
  })

  it('works before the anchor date', () => {
    expect(currentFortnightEnd(new Date('2026-07-01T00:00:00Z'))).toBe('2026-06-21')
  })
})

describe('stepFortnight', () => {
  it('steps forward and back by fourteen days', () => {
    expect(stepFortnight('2026-08-02', 1)).toBe('2026-08-16')
    expect(stepFortnight('2026-08-02', -1)).toBe('2026-07-19')
  })

  it('keeps every step on cycle', () => {
    let end = FORTNIGHT_ANCHOR
    for (let i = 0; i < 30; i++) {
      end = stepFortnight(end, 1)
      expect(isOnCycle(end)).toBe(true)
    }
  })
})

describe('bucketEndFor', () => {
  it('buckets an on-cycle end to itself', () => {
    expect(bucketEndFor('2026-08-02')).toBe('2026-08-02')
  })

  it('buckets the first day of a window to that window', () => {
    expect(bucketEndFor('2026-07-20')).toBe('2026-08-02')
  })

  /**
   * Joshua Del Rosario's real statement ends Mon 3 Aug, the first day of the
   * 3–16 Aug window, so it belongs to the 16 Aug fortnight — flagged, not lost.
   */
  it('buckets an off-cycle Monday into the following window', () => {
    expect(bucketEndFor('2026-08-03')).toBe('2026-08-16')
  })

  it('buckets a monthly bonus period end', () => {
    expect(bucketEndFor('2026-08-31')).toBe('2026-09-13')
  })

  it('buckets a date before the anchor', () => {
    expect(bucketEndFor('2026-07-19')).toBe('2026-07-19')
    expect(bucketEndFor('2026-07-18')).toBe('2026-07-19')
  })

  /** Every date lands in exactly one bucket — nothing can fall through. */
  it('always returns an on-cycle boundary that contains the date', () => {
    for (let day = 1; day <= 28; day++) {
      const date = `2026-09-${String(day).padStart(2, '0')}`
      const bucket = bucketEndFor(date)
      expect(isOnCycle(bucket)).toBe(true)
      const window = fortnightWindow(bucket)
      expect(date >= window.start && date <= window.end).toBe(true)
    }
  })
})
