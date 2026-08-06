import { describe, it, expect } from 'vitest'
import { metaRows, type StatementMeta } from '../StatementDocument'

// Deliberately distinct, non-overlapping values: if the wrong identifier were
// printed against a label, or a row dropped, these assertions fail. Rendering
// to PDF bytes cannot catch that — it only proves a file was produced.
const meta: StatementMeta = {
  type: 'fortnightly',
  periodStart: '2026-07-21',
  periodEnd: '2026-08-03',
  reference: 'INV-ATCVEXGZ',
  submittedAt: '2026-08-04T09:00:00.000Z',
  contractorInvoiceNumber: 'HG-2026-014',
  declarationAcceptedAt: '2026-08-04T09:00:00.000Z',
}

function valueFor(label: string): string | undefined {
  return metaRows(meta).find((row) => row.label === label)?.value
}

describe('metaRows', () => {
  it('prints neither identifier — not the contractor’s number, not the internal reference', () => {
    // Both removed at the client's request. Both are still collected and
    // stored on the Airtable record; these assertions pin only that they stay
    // off the printed page, so restoring either is a deliberate decision
    // rather than an accident.
    const values = metaRows(meta).map((row) => row.value)
    expect(values).not.toContain(meta.contractorInvoiceNumber)
    expect(values).not.toContain(meta.reference)

    const labels = metaRows(meta).map((row) => row.label)
    expect(labels).not.toContain('Invoice no.')
    expect(labels).not.toContain('Reference')
  })

  it('prints the date and period, and nothing else', () => {
    expect(metaRows(meta).map((row) => row.label)).toEqual(['Date', 'Period'])
  })

  it('prints the submitted date in Perth time and the claimed period', () => {
    // 09:00 UTC on 4 Aug is 17:00 the same day in Perth (UTC+8).
    expect(valueFor('Date')).toBe('Tue 4 Aug 2026')
    expect(valueFor('Period')).toBe('Tue 21 Jul 2026 – Mon 3 Aug 2026')
  })
})
