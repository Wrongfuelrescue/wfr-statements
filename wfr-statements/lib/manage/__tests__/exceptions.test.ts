import { describe, expect, it } from 'vitest'
import { findExceptions } from '../exceptions'
import { rosterEntry, statement } from './factories'

describe('findExceptions', () => {
  it('finds nothing when everything is clean', () => {
    expect(findExceptions([statement()], [rosterEntry()])).toEqual([])
  })

  it('flags a non-empty Warnings cell', () => {
    const rows = findExceptions([statement({ warnings: 'PDF attach failed' })], [rosterEntry()])
    expect(rows[0].kind).toBe('warnings')
    expect(rows[0].detail).toContain('PDF attach failed')
    expect(rows[0].statementId).toBe('recSTATEMENT00001')
  })

  it('flags a blank Status as an incomplete write', () => {
    const rows = findExceptions([statement({ status: '' })], [rosterEntry()])
    const row = rows.find((r) => r.kind === 'incomplete')
    expect(row).toBeDefined()
    expect(row?.fix).toContain('not reconcile')
  })

  it('flags a superseded statement', () => {
    const rows = findExceptions([statement({ status: 'Superseded' })], [rosterEntry()])
    expect(rows.map((r) => r.kind)).toContain('superseded')
  })

  it('flags an off-cycle period end', () => {
    const rows = findExceptions([statement({ periodEnd: '2026-08-03' })], [rosterEntry()])
    expect(rows.map((r) => r.kind)).toContain('off-cycle')
  })

  /**
   * A monthly bonus period ends at month end, which is almost never a
   * fortnight boundary — flagging it would fire for every bonus statement
   * every month and train the reader to ignore the whole screen. Only a
   * fortnightly statement can be off-cycle.
   */
  it('never flags a monthly bonus statement as off-cycle', () => {
    const rows = findExceptions(
      [
        statement({
          type: 'Monthly Bonus',
          periodStart: '2026-08-01',
          periodEnd: '2026-08-31',
        }),
      ],
      [rosterEntry()],
    )
    expect(rows).toEqual([])
  })

  /** Not period-bound: the ABN check runs across the whole roster. */
  it('flags every contractor with a blank ABN', () => {
    const rows = findExceptions(
      [],
      [
        rosterEntry({ abn: '' }),
        rosterEntry({ id: 'recCONTRACTOR0002', name: 'SIMON CAMERON', abn: '' }),
      ],
    )
    expect(rows.filter((r) => r.kind === 'no-abn')).toHaveLength(2)
    expect(rows[0].fix).toContain('INVOICE MATRIX')
  })

  it('does not flag a contractor with no PIN for a missing ABN', () => {
    expect(findExceptions([], [rosterEntry({ abn: '', hasPin: false })])).toEqual([])
  })

  it('reports several problems on one statement separately', () => {
    const rows = findExceptions(
      [statement({ status: '', warnings: 'receipt upload failed', periodEnd: '2026-08-03' })],
      [rosterEntry()],
    )
    expect(rows.map((r) => r.kind).sort()).toEqual(['incomplete', 'off-cycle', 'warnings'])
  })

  it('names the contractor and period in every statement-level subject', () => {
    const rows = findExceptions([statement({ warnings: 'x' })], [rosterEntry()])
    expect(rows[0].subject).toContain('PATRICK HUTCHINSON')
    expect(rows[0].subject).toContain('2026-08-02')
  })
})
