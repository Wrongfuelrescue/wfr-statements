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
  it('prints the contractor’s own invoice number, not the internal reference', () => {
    // The contractor's number was restored to the page at WFR's request; the
    // internal reference stays off it. The two are not interchangeable — only
    // the reference is unique across contractors — so printing the reference
    // under an "Invoice no." label would be actively misleading.
    expect(valueFor('Invoice no.')).toBe(meta.contractorInvoiceNumber)

    const values = metaRows(meta).map((row) => row.value)
    expect(values).not.toContain(meta.reference)
    expect(metaRows(meta).map((row) => row.label)).not.toContain('Reference')
  })

  it('prints the invoice number, date and period, and nothing else', () => {
    expect(metaRows(meta).map((row) => row.label)).toEqual(['Invoice no.', 'Date', 'Period'])
  })

  it('prints the submitted date in Perth time and the claimed period', () => {
    // 09:00 UTC on 4 Aug is 17:00 the same day in Perth (UTC+8).
    expect(valueFor('Date')).toBe('Tue 4 Aug 2026')
    expect(valueFor('Period')).toBe('Tue 21 Jul 2026 – Mon 3 Aug 2026')
  })
})
