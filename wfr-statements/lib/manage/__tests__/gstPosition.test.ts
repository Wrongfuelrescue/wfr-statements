import { describe, expect, it } from 'vitest'
import { buildGstPosition } from '../gstPosition'
import { rosterEntry, statement } from './factories'

describe('buildGstPosition', () => {
  it('totals GST charged across the quarter', () => {
    const position = buildGstPosition(
      [
        statement(),
        statement({
          id: 'recSTATEMENT00002',
          contractorId: 'recCONTRACTOR0002',
          contractorName: 'SIMON CAMERON',
          gst: 57.95,
          subtotal: 579.54,
        }),
      ],
      [rosterEntry(), rosterEntry({ id: 'recCONTRACTOR0002', name: 'SIMON CAMERON' })],
    )
    expect(position.totalGst).toBe(150.68)
    expect(position.statementCount).toBe(2)
  })

  it('groups several statements from one contractor into a single row', () => {
    const position = buildGstPosition(
      [statement(), statement({ id: 'recSTATEMENT00002', gst: 10, subtotal: 100 })],
      [rosterEntry()],
    )
    expect(position.rows).toHaveLength(1)
    expect(position.rows[0].gst).toBe(102.73)
    expect(position.rows[0].subtotal).toBe(1027.26)
  })

  /**
   * The number that makes the headline unreliable: GST charged on invoices
   * WFR cannot claim against, because there is no supplier ABN.
   */
  it('counts GST on statements from contractors with no ABN as unclaimable', () => {
    const position = buildGstPosition([statement()], [rosterEntry({ abn: '' })])
    expect(position.unclaimableGst).toBe(92.73)
    expect(position.noAbnCount).toBe(1)
    expect(position.rows[0].abnOnFile).toBe(false)
  })

  it('counts no unclaimable GST when every ABN is on file', () => {
    const position = buildGstPosition([statement()], [rosterEntry()])
    expect(position.unclaimableGst).toBe(0)
    expect(position.noAbnCount).toBe(0)
  })

  it('totals reimbursements separately, since they are treated as GST-free', () => {
    expect(buildGstPosition([statement()], [rosterEntry()]).totalReimbursements).toBe(50)
  })

  it('excludes superseded and incomplete statements', () => {
    const position = buildGstPosition(
      [statement({ status: 'Superseded' }), statement({ id: 'recX00000000000001', status: '' })],
      [rosterEntry()],
    )
    expect(position.totalGst).toBe(0)
    expect(position.rows).toEqual([])
  })

  /** No roster row means no ABN we can read — the same problem as a blank one. */
  it('treats a contractor missing from the roster as having no ABN', () => {
    const position = buildGstPosition([statement({ contractorId: 'recGONE0000000001' })], [])
    expect(position.rows[0].abnOnFile).toBe(false)
    expect(position.unclaimableGst).toBe(92.73)
  })

  it('carries the GST-registration flag recorded at submission', () => {
    const position = buildGstPosition(
      [statement({ gstRegisteredAtSubmission: false, gst: 0 })],
      [rosterEntry()],
    )
    expect(position.rows[0].registered).toBe(false)
  })

  it('sorts rows by GST, largest first', () => {
    const position = buildGstPosition(
      [
        statement({ gst: 10 }),
        statement({
          id: 'recSTATEMENT00002',
          contractorId: 'recCONTRACTOR0002',
          contractorName: 'SIMON CAMERON',
          gst: 200,
        }),
      ],
      [rosterEntry(), rosterEntry({ id: 'recCONTRACTOR0002', name: 'SIMON CAMERON' })],
    )
    expect(position.rows.map((r) => r.contractorName)).toEqual([
      'SIMON CAMERON',
      'PATRICK HUTCHINSON',
    ])
  })
})
