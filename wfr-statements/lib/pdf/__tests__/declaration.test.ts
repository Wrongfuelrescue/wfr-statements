import { describe, it, expect } from 'vitest'
import { isValidElement, type ReactNode } from 'react'
import { StatementDocument, type StatementMeta } from '../StatementDocument'
import { CONTRACTOR_DECLARATION } from '@/lib/invoice/declaration'
import { rollUpTotals } from '@/lib/calc/totals'
import type { RateCard } from '@/lib/rates/types'

// Asserted against the rendered *element tree*, not the PDF bytes. A test that
// only checks bytes came back still passes when the declaration silently stops
// rendering — the exact vacuous test this file exists to avoid.

const rates: RateCard = {
  contractorId: 'rec1',
  name: 'HARLEY GATT',
  abn: '11 222 333 444',
  address: '1 Test St',
  bankAccount: '12345678',
  bankBsb: '123-456',
  standardDayHours: 11,
  van: 'MEL VAN 2',
  city: 'MEL',
  shiftPattern: 'Week on / Week off',
  gstRegistered: true,
  baseShift: 425,
  additionalLabour: 77.27,
  rosteredDayOff: 525,
  minorService: null,
  majorService: null,
  googleReviewBonus: 15,
  fuelFilter30: 30,
  fuelFilter70: 70,
}

const totals = rollUpTotals(
  [
    {
      date: '2026-07-21',
      lineType: 'Sub Contractor Labour Hire',
      quantity: 1,
      unitRate: 425,
      amount: 425,
      description: '',
      gstBearing: true,
    },
  ],
  true,
)

const meta: StatementMeta = {
  type: 'fortnightly',
  periodStart: '2026-07-21',
  periodEnd: '2026-08-03',
  reference: 'INV-ATCVEXGZ',
  submittedAt: '2026-08-04T09:00:00.000Z',
  contractorInvoiceNumber: 'HG-2026-014',
  declarationAcceptedAt: '2026-08-04T09:00:00.000Z',
}

/** Every string in the document's element tree, in document order. */
function texts(node: ReactNode): string[] {
  if (typeof node === 'string') return [node]
  if (typeof node === 'number') return [String(node)]
  if (Array.isArray(node)) return node.flatMap(texts)
  if (isValidElement(node)) {
    const { children } = node.props as { children?: ReactNode }
    return texts(children)
  }
  return []
}

const rendered = texts(StatementDocument({ totals, rates, meta }))

describe('the declaration on the invoice', () => {
  it('prints the declaration, word for word', () => {
    expect(rendered).toContain(CONTRACTOR_DECLARATION)
  })

  it('labels it so the reader knows what it is', () => {
    expect(rendered).toContain('Declaration')
  })

  it('prints the declaration after the payment details, not in place of them', () => {
    expect(rendered).toContain('Payment')
    expect(rendered.indexOf('Payment')).toBeLessThan(rendered.indexOf('Declaration'))
  })
})
