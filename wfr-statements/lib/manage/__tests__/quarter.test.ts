import { describe, expect, it } from 'vitest'
import { currentQuarter, quarterFor, stepQuarter } from '../quarter'

describe('quarterFor', () => {
  it('places August in the Jul–Sep quarter', () => {
    expect(quarterFor('2026-08-05')).toEqual({
      label: 'Jul–Sep 2026',
      start: '2026-07-01',
      end: '2026-09-30',
    })
  })

  it('places January in the Jan–Mar quarter', () => {
    expect(quarterFor('2027-01-15')).toEqual({
      label: 'Jan–Mar 2027',
      start: '2027-01-01',
      end: '2027-03-31',
    })
  })

  it('handles the first and last day of a quarter', () => {
    expect(quarterFor('2026-04-01').label).toBe('Apr–Jun 2026')
    expect(quarterFor('2026-06-30').label).toBe('Apr–Jun 2026')
  })

  it('handles a December date', () => {
    expect(quarterFor('2026-12-31')).toEqual({
      label: 'Oct–Dec 2026',
      start: '2026-10-01',
      end: '2026-12-31',
    })
  })

  it('handles a leap year', () => {
    expect(quarterFor('2028-02-29').end).toBe('2028-03-31')
  })
})

describe('currentQuarter', () => {
  it('derives the quarter from a date', () => {
    expect(currentQuarter(new Date('2026-08-05T00:00:00Z')).label).toBe('Jul–Sep 2026')
  })
})

describe('stepQuarter', () => {
  it('steps forward within a year', () => {
    expect(stepQuarter(quarterFor('2026-08-05'), 1).label).toBe('Oct–Dec 2026')
  })

  it('steps forward across a calendar year boundary', () => {
    expect(stepQuarter(quarterFor('2026-11-01'), 1)).toEqual({
      label: 'Jan–Mar 2027',
      start: '2027-01-01',
      end: '2027-03-31',
    })
  })

  it('steps back across a calendar year boundary', () => {
    expect(stepQuarter(quarterFor('2027-01-15'), -1).label).toBe('Oct–Dec 2026')
  })

  it('round-trips forward then back', () => {
    const start = quarterFor('2026-08-05')
    expect(stepQuarter(stepQuarter(start, 1), -1)).toEqual(start)
  })
})
