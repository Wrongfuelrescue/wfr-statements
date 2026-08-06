import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ClaimSummary } from '../ClaimSummary'
import { calculateMonthly } from '@/lib/calc/monthly'
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

describe('ClaimSummary subtotal label', () => {
  it('shows "Work subtotal" on a fortnightly-shaped statement', () => {
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
    render(<ClaimSummary totals={totals} />)
    expect(screen.getByText('Work subtotal')).toBeInTheDocument()
    expect(screen.queryByText('Subtotal (bonuses)')).not.toBeInTheDocument()
  })

  it('shows "Subtotal (bonuses)" on a bonus-only statement', () => {
    const totals = calculateMonthly(
      { googleReviews: 2, fuelFilter30: 0, fuelFilter70: 0, note: '' },
      rates,
    )
    render(<ClaimSummary totals={totals} />)
    expect(screen.getByText('Subtotal (bonuses)')).toBeInTheDocument()
    expect(screen.queryByText('Work subtotal')).not.toBeInTheDocument()
  })
})

describe('ClaimSummary dateless line label', () => {
  it('labels a dateless line "For the period" rather than "For the month", on a fortnightly reimbursement', () => {
    // The fortnight-level reimbursement carries date: null — "For the month"
    // is simply wrong on a fortnightly statement, and the PDF (which shows
    // '—' for the same dateless line) must not disagree with this surface.
    const totals = rollUpTotals(
      [
        {
          date: null,
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
    render(<ClaimSummary totals={totals} />)
    expect(screen.getByText(/For the period/)).toBeInTheDocument()
    expect(screen.queryByText(/For the month/)).not.toBeInTheDocument()
  })
})

describe('ClaimSummary statement-level note', () => {
  it('shows the monthly note as a standalone remark, not attached to a line', () => {
    const totals = calculateMonthly(
      { googleReviews: 2, fuelFilter30: 1, fuelFilter70: 0, note: 'Fuel filters at the depot' },
      rates,
    )
    render(<ClaimSummary totals={totals} />)
    expect(screen.getByText('Fuel filters at the depot')).toBeInTheDocument()
    // Not glued onto the Google Review Bonus line, which is unrelated to the note.
    const bonusLineRow = screen.getByText('Google Review Bonus').closest('li')
    expect(bonusLineRow).not.toHaveTextContent('Fuel filters at the depot')
  })

  it('shows no note section when there is none', () => {
    const totals = calculateMonthly(
      { googleReviews: 2, fuelFilter30: 0, fuelFilter70: 0, note: '' },
      rates,
    )
    const { container } = render(<ClaimSummary totals={totals} />)
    expect(container.textContent).not.toMatch(/undefined|null/)
  })
})
