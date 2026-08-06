import { describe, it, expect } from 'vitest'
import { renderStatementPdf } from '../render'
import { rollUpTotals } from '@/lib/calc/totals'
import type { RateCard } from '@/lib/rates/types'

const rates: RateCard = {
  contractorId: 'rec1',
  name: 'HARLEY GATT',
  abn: '',
  address: '',
  bankAccount: '',
  bankBsb: '',
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
    {
      date: '2026-07-22',
      lineType: 'Reimbursement',
      quantity: 1,
      unitRate: 45,
      amount: 45,
      description: 'Car wash',
      gstBearing: false,
    },
  ],
  true,
)

describe('renderStatementPdf', () => {
  it('produces a non-empty PDF buffer', async () => {
    const buffer = await renderStatementPdf(totals, rates, {
      type: 'fortnightly',
      periodStart: '2026-07-21',
      periodEnd: '2026-08-03',
      reference: 'INV-ATCVEXGZ',
      submittedAt: '2026-08-04T09:00:00.000Z',
      contractorInvoiceNumber: 'INV-001',
      declarationAcceptedAt: '2026-08-04T09:00:00.000Z',
    })
    expect(buffer.length).toBeGreaterThan(1000)
  })

  it('produces a file with a PDF magic header', async () => {
    const buffer = await renderStatementPdf(totals, rates, {
      type: 'fortnightly',
      periodStart: '2026-07-21',
      periodEnd: '2026-08-03',
      reference: 'INV-ATCVEXGZ',
      submittedAt: '2026-08-04T09:00:00.000Z',
      contractorInvoiceNumber: 'INV-001',
      declarationAcceptedAt: '2026-08-04T09:00:00.000Z',
    })
    expect(buffer.subarray(0, 4).toString('latin1')).toBe('%PDF')
  })

  it('renders a monthly statement without throwing', async () => {
    const buffer = await renderStatementPdf(
      rollUpTotals(
        [
          {
            date: null,
            lineType: 'Google Review Bonus',
            quantity: 4,
            unitRate: 15,
            amount: 60,
            description: '',
            // Performance bonuses do not attract GST.
            gstBearing: false,
          },
        ],
        false,
      ),
      { ...rates, gstRegistered: false },
      {
        type: 'monthly',
        periodStart: '2026-07-01',
        periodEnd: '2026-07-31',
        reference: 'INV-ATCVEXGZ',
        submittedAt: '2026-08-04T09:00:00.000Z',
        contractorInvoiceNumber: 'INV-001',
        declarationAcceptedAt: '2026-08-04T09:00:00.000Z',
      },
    )
    expect(buffer.subarray(0, 4).toString('latin1')).toBe('%PDF')
  })

  it('renders a monthly bonus statement for a GST-registered contractor without throwing', async () => {
    // This is the case where gstBase < workSubtotal while gstRegistered is
    // true — the case that surfaces the "bonuses are not subject to GST" note.
    const buffer = await renderStatementPdf(
      rollUpTotals(
        [
          {
            date: null,
            lineType: 'Google Review Bonus',
            quantity: 4,
            unitRate: 15,
            amount: 60,
            description: '',
            gstBearing: false,
          },
        ],
        true,
      ),
      rates,
      {
        type: 'monthly',
        periodStart: '2026-07-01',
        periodEnd: '2026-07-31',
        reference: 'INV-ATCVEXGZ',
        submittedAt: '2026-08-04T09:00:00.000Z',
        contractorInvoiceNumber: 'INV-001',
        declarationAcceptedAt: '2026-08-04T09:00:00.000Z',
      },
    )
    expect(buffer.subarray(0, 4).toString('latin1')).toBe('%PDF')
  })

  it('renders for a contractor whose identity fields are not yet filled in', async () => {
    const buffer = await renderStatementPdf(
      totals,
      { ...rates, abn: '', address: '', bankAccount: '', bankBsb: '' },
      {
        type: 'fortnightly',
        periodStart: '2026-07-21',
        periodEnd: '2026-08-03',
        reference: 'INV-TESTTEST',
        submittedAt: '2026-08-04T02:00:00.000Z',
        contractorInvoiceNumber: 'INV-001',
        declarationAcceptedAt: '2026-08-04T09:00:00.000Z',
      },
    )
    expect(buffer.subarray(0, 4).toString('latin1')).toBe('%PDF')
  })

  it('renders without throwing when a contractor supplies a long invoice number', async () => {
    // A smoke test only — it asserts a file came out, nothing about content.
    // The contractor's number is deliberately NOT printed on the invoice (see
    // metaRows), and it is metaRows.test.ts that holds that assertion. Do not
    // read this test as evidence either way about what appears on the page.
    const buffer = await renderStatementPdf(totals, rates, {
      type: 'fortnightly',
      periodStart: '2026-07-21',
      periodEnd: '2026-08-03',
      reference: 'INV-ATCVEXGZ',
      submittedAt: '2026-08-04T09:00:00.000Z',
      contractorInvoiceNumber: 'HG-2026-014',
      declarationAcceptedAt: '2026-08-04T09:00:00.000Z',
    })
    expect(buffer.length).toBeGreaterThan(1000)
    expect(buffer.subarray(0, 4).toString('latin1')).toBe('%PDF')
  })
})
