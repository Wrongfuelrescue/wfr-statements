import { describe, expect, it } from 'vitest'
import type { LineType } from '@/lib/calc/types'
import { buildPayRun, groupForLineType, rollUpByDimension, rollUpByGroup } from '../rollup'
import { line, rosterEntry, statement } from './factories'

describe('buildPayRun', () => {
  it('lists a contractor who has not submitted as a row with no statement', () => {
    const run = buildPayRun(
      '2026-08-02',
      [],
      [rosterEntry(), rosterEntry({ id: 'recCONTRACTOR0002', name: 'SIMON CAMERON' })],
    )
    expect(run.rows).toHaveLength(2)
    expect(run.rows.every((r) => r.statement === null)).toBe(true)
    expect(run.submittedCount).toBe(0)
    expect(run.expectedCount).toBe(2)
    expect(run.totalPayable).toBe(0)
  })

  /** A blank PIN means the contractor cannot log in, so cannot be expected to submit. */
  it('excludes contractors with no PIN from the expected list', () => {
    const run = buildPayRun('2026-08-02', [], [rosterEntry({ hasPin: false })])
    expect(run.rows).toHaveLength(0)
    expect(run.expectedCount).toBe(0)
  })

  it('attaches a statement whose period end is on the boundary', () => {
    const run = buildPayRun('2026-08-02', [statement()], [rosterEntry()])
    expect(run.rows[0].statement?.id).toBe('recSTATEMENT00001')
    expect(run.rows[0].offCycle).toBe(false)
    expect(run.submittedCount).toBe(1)
    expect(run.totalPayable).toBe(1069.99)
    expect(run.totalGst).toBe(92.73)
    expect(run.totalReimbursements).toBe(50)
  })

  /**
   * Joshua Del Rosario's real statement ends Mon 3 Aug, which falls in the
   * 3–16 Aug window. It belongs to that fortnight, flagged — not to nowhere.
   */
  it('attaches an off-cycle statement to its bucket and flags it', () => {
    const run = buildPayRun(
      '2026-08-16',
      [statement({ periodEnd: '2026-08-03', total: 3272.5 })],
      [rosterEntry()],
    )
    expect(run.rows[0].offCycle).toBe(true)
    expect(run.totalPayable).toBe(3272.5)
  })

  it('ignores a statement that belongs to a different fortnight', () => {
    const run = buildPayRun('2026-08-16', [statement()], [rosterEntry()])
    expect(run.rows[0].statement).toBeNull()
    expect(run.totalPayable).toBe(0)
  })

  /** A blank Status is an incomplete write. It must not read as a submission. */
  it('does not count a blank-Status row as submitted', () => {
    const run = buildPayRun('2026-08-02', [statement({ status: '' })], [rosterEntry()])
    expect(run.rows[0].statement).toBeNull()
    expect(run.submittedCount).toBe(0)
    expect(run.totalPayable).toBe(0)
  })

  it('does not count a superseded row as submitted', () => {
    const run = buildPayRun('2026-08-02', [statement({ status: 'Superseded' })], [rosterEntry()])
    expect(run.rows[0].statement).toBeNull()
    expect(run.totalPayable).toBe(0)
  })

  it('puts monthly bonus statements in their own bucket and in the payable total', () => {
    const run = buildPayRun(
      '2026-09-13',
      [
        statement({
          type: 'Monthly Bonus',
          periodStart: '2026-08-01',
          periodEnd: '2026-08-31',
          total: 500,
          gst: 0,
          subtotal: 500,
          reimbursements: 0,
        }),
      ],
      [rosterEntry()],
    )
    expect(run.bonuses).toHaveLength(1)
    expect(run.rows[0].statement).toBeNull()
    expect(run.totalPayable).toBe(500)
  })

  /** A leaver's statement is still real money and must not vanish. */
  it('includes a statement from someone no longer on the roster', () => {
    const run = buildPayRun(
      '2026-08-02',
      [statement({ contractorId: 'recGONE0000000001', contractorName: 'A LEAVER' })],
      [rosterEntry()],
    )
    expect(run.rows).toHaveLength(2)
    expect(run.totalPayable).toBe(1069.99)
  })

  it('sorts rows by contractor name', () => {
    const run = buildPayRun(
      '2026-08-02',
      [],
      [
        rosterEntry({ id: 'recCONTRACTOR0002', name: 'SIMON CAMERON' }),
        rosterEntry({ id: 'recCONTRACTOR0003', name: 'GORDEN LOCKHART' }),
      ],
    )
    expect(run.rows.map((r) => r.contractorName)).toEqual(['GORDEN LOCKHART', 'SIMON CAMERON'])
  })

  it('sums several contractors without floating-point drift', () => {
    const run = buildPayRun(
      '2026-08-02',
      [
        statement({ total: 1069.99 }),
        statement({ id: 'recSTATEMENT00002', contractorId: 'recCONTRACTOR0002', total: 677.49 }),
      ],
      [rosterEntry(), rosterEntry({ id: 'recCONTRACTOR0002', name: 'SIMON CAMERON' })],
    )
    expect(run.totalPayable).toBe(1747.48)
  })
})

describe('groupForLineType', () => {
  it('groups an adjusted shift with base shifts', () => {
    expect(groupForLineType('Base Shift')).toBe('Base shifts')
    expect(groupForLineType('Adjusted Shift')).toBe('Base shifts')
  })

  it('groups both service types as vehicle servicing', () => {
    expect(groupForLineType('Minor Service')).toBe('Vehicle servicing')
    expect(groupForLineType('Major Service')).toBe('Vehicle servicing')
  })

  it('groups all three bonus types as bonuses', () => {
    expect(groupForLineType('Google Review Bonus')).toBe('Bonuses')
    expect(groupForLineType('Fuel Filter $30')).toBe('Bonuses')
    expect(groupForLineType('Fuel Filter $70')).toBe('Bonuses')
  })

  /** A line type added later must stay visible, not vanish from the total. */
  it('puts an unrecognised line type in Other', () => {
    expect(groupForLineType('Something New')).toBe('Other')
  })

  /**
   * The Line Type choices were renamed in Airtable to WFR's own accounting
   * terms after the app shipped. Renaming a single-select option rewrites
   * what every existing record reads as, so the stored values no longer match
   * the app's LineType constants — without these aliases every line falls
   * into "Other" and the category breakdown becomes one meaningless bar.
   * Verified against the live base's choice list.
   */
  describe('live Airtable option names', () => {
    it('groups the renamed labour-hire rates', () => {
      expect(groupForLineType('Sub Contractor Labour Hire')).toBe('Base shifts')
      expect(groupForLineType('Sub Contractor Labour Hire Rate')).toBe('Base shifts')
      expect(groupForLineType('Sub Contractor Labour Hire – RDA Rate')).toBe('Rostered days off')
      expect(groupForLineType('Sub Contractor Labour Hire – Additional Hours')).toBe(
        'Additional labour',
      )
    })

    /**
     * v3 renamed the adjusted shift too. Every value in the app's LineType
     * union must map to something other than 'Other' — this is the check that
     * catches the next rename, not just this one.
     */
    it('groups the renamed adjusted shift with base shifts', () => {
      expect(groupForLineType('Sub Contractor Labour Hire – Adjusted Hours')).toBe('Base shifts')
    })

    it('maps every line type the app can currently write', () => {
      const written: LineType[] = [
        'Sub Contractor Labour Hire',
        'Sub Contractor Labour Hire – RDA Rate',
        'Sub Contractor Labour Hire – Adjusted Hours',
        'Sub Contractor Labour Hire – Additional Hours',
        'Minor Service',
        'Major Service',
        'Reimbursement',
        'Google Review Bonus',
        'Fuel Filter Sales Bonus $30',
        'Fuel Filter Sales Bonus $70',
      ]
      const unmapped = written.filter((type) => groupForLineType(type) === 'Other')
      expect(unmapped).toEqual([])
    })

    it('groups the renamed fuel filter bonuses', () => {
      expect(groupForLineType('Fuel Filter Sales Bonus $30')).toBe('Bonuses')
      expect(groupForLineType('Fuel Filter Sales Bonus $70')).toBe('Bonuses')
    })

    it('still groups the option names that were not renamed', () => {
      expect(groupForLineType('Adjusted Shift')).toBe('Base shifts')
      expect(groupForLineType('Minor Service')).toBe('Vehicle servicing')
      expect(groupForLineType('Reimbursement')).toBe('Reimbursements')
      expect(groupForLineType('Google Review Bonus')).toBe('Bonuses')
    })

    /** An en dash and a hyphen must not be different categories. */
    it('treats a hyphen and an en dash the same', () => {
      expect(groupForLineType('Sub Contractor Labour Hire - Additional Hours')).toBe(
        'Additional labour',
      )
    })
  })
})

describe('rollUpByGroup', () => {
  it('sums by group and computes each share, largest first', () => {
    const slices = rollUpByGroup([
      line({ amount: 300 }),
      line({ id: 'recLINE0000000002', lineType: 'Reimbursement', amount: 100 }),
      line({ id: 'recLINE0000000003', lineType: 'Adjusted Shift', amount: 100 }),
    ])
    expect(slices[0]).toEqual({ key: 'Base shifts', amount: 400, share: 0.8 })
    expect(slices[1]).toEqual({ key: 'Reimbursements', amount: 100, share: 0.2 })
  })

  it('returns an empty list rather than dividing by zero', () => {
    expect(rollUpByGroup([])).toEqual([])
  })
})

describe('rollUpByDimension', () => {
  it('sums ex-GST cost by city', () => {
    const slices = rollUpByDimension(
      [statement(), statement({ id: 'recSTATEMENT00002', contractorId: 'recCONTRACTOR0002' })],
      [rosterEntry(), rosterEntry({ id: 'recCONTRACTOR0002', name: 'SIMON CAMERON', city: 'PER' })],
      'city',
    )
    // subtotal + reimbursements, i.e. total minus GST.
    expect(slices).toEqual([
      { key: 'MEL', amount: 977.26, share: 0.5 },
      { key: 'PER', amount: 977.26, share: 0.5 },
    ])
  })

  it('sums by van', () => {
    const slices = rollUpByDimension([statement()], [rosterEntry()], 'van')
    expect(slices[0].key).toBe('MEL VAN 2')
  })

  it('labels a contractor missing from the roster as Unknown', () => {
    const slices = rollUpByDimension([statement({ contractorId: 'recGONE0000000001' })], [], 'van')
    expect(slices[0].key).toBe('Unknown')
  })

  it('excludes superseded and incomplete statements from cost', () => {
    const slices = rollUpByDimension(
      [statement({ status: 'Superseded' }), statement({ id: 'recX00000000000001', status: '' })],
      [rosterEntry()],
      'city',
    )
    expect(slices).toEqual([])
  })
})
