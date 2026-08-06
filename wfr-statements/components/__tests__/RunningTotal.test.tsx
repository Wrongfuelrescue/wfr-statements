import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RunningTotal } from '../RunningTotal'
import { rollUpTotals } from '@/lib/calc/totals'

const fortnightlyTotals = rollUpTotals(
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

const bonusLine = {
  date: null,
  lineType: 'Google Review Bonus' as const,
  quantity: 4,
  unitRate: 15,
  amount: 60,
  description: '',
  gstBearing: true,
}

describe('RunningTotal', () => {
  it('shows the GST line for a registered contractor', () => {
    render(<RunningTotal totals={fortnightlyTotals} />)
    expect(screen.getByText('GST (10%)')).toBeInTheDocument()
  })

  it('hides the GST line and notes the status for an unregistered contractor', () => {
    render(<RunningTotal totals={rollUpTotals(fortnightlyTotals.lines, false)} />)
    expect(screen.queryByText('GST (10%)')).not.toBeInTheDocument()
    expect(screen.getByText(/not registered for GST/i)).toBeInTheDocument()
  })

  it('shows no note for a registered contractor on a bonus statement', () => {
    const totals = rollUpTotals([bonusLine], true)
    render(<RunningTotal totals={totals} />)
    expect(screen.queryByText(/not registered for GST/i)).not.toBeInTheDocument()
  })

  it('shows the not-registered note for an unregistered contractor on a bonus statement', () => {
    const totals = rollUpTotals([bonusLine], false)
    render(<RunningTotal totals={totals} />)
    expect(screen.getByText(/not registered for GST/i)).toBeInTheDocument()
  })
})
