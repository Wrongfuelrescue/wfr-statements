import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BreakdownBars } from '../BreakdownBars'

const slices = [
  { key: 'Base shifts', amount: 4000, share: 0.8 },
  { key: 'Reimbursements', amount: 1000, share: 0.2 },
]

describe('BreakdownBars', () => {
  it('renders its title', () => {
    render(<BreakdownBars title="By category" slices={slices} />)
    expect(screen.getByRole('heading', { name: 'By category' })).toBeInTheDocument()
  })

  it('renders each slice with its amount and share', () => {
    render(<BreakdownBars title="By category" slices={slices} />)
    expect(screen.getByText('Base shifts')).toBeInTheDocument()
    expect(screen.getByText('$4,000.00')).toBeInTheDocument()
    expect(screen.getByText('80%')).toBeInTheDocument()
  })

  /** The bars are decoration; the row must be readable without seeing them. */
  it('labels each row for a screen reader', () => {
    render(<BreakdownBars title="By category" slices={slices} />)
    expect(
      screen.getByRole('img', { name: 'Base shifts: $4,000.00, 80% of total' }),
    ).toBeInTheDocument()
  })

  it('scales each bar to its share', () => {
    render(<BreakdownBars title="By category" slices={slices} />)
    const bar = screen
      .getByRole('img', { name: /Base shifts/ })
      .querySelector('[data-bar]') as HTMLElement
    expect(bar).toHaveStyle({ width: '80%' })
  })

  it('shows an empty state rather than an empty chart', () => {
    render(<BreakdownBars title="By city" slices={[]} />)
    expect(screen.getByText(/nothing to show/i)).toBeInTheDocument()
  })
})
