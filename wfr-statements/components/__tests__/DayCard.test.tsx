import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DayCard } from '../DayCard'
import { calculateFortnightly } from '@/lib/calc/fortnightly'
import type { DayEntry } from '@/lib/calc/types'
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

const emptyDay: DayEntry = {
  date: '2026-07-21',
  shift: 'none',
  adjustedHours: 0,
  additionalLabourHours: 0,
  service: 'none',
}

describe('DayCard', () => {
  it('shows the formatted date', () => {
    render(<DayCard entry={emptyDay} rates={rates} onChange={vi.fn()} />)
    expect(screen.getByText('Tue 21 Jul')).toBeInTheDocument()
  })

  it('shows "no work" when the day is empty', () => {
    render(<DayCard entry={emptyDay} rates={rates} onChange={vi.fn()} />)
    expect(screen.getByText(/no work/i)).toBeInTheDocument()
  })

  it('shows the day total when the day has a base shift', () => {
    render(
      <DayCard entry={{ ...emptyDay, shift: 'base' }} rates={rates} onChange={vi.fn()} />,
    )
    expect(screen.getByText('$425.00')).toBeInTheDocument()
  })

  it('hides servicing options when the contractor has an N/A rate', () => {
    render(<DayCard entry={emptyDay} rates={rates} onChange={vi.fn()} defaultOpen />)
    expect(screen.queryByLabelText(/vehicle service/i)).not.toBeInTheDocument()
  })

  it('shows servicing options when the contractor is entitled', () => {
    render(
      <DayCard
        entry={emptyDay}
        rates={{ ...rates, minorService: 77.27, majorService: 115.91 }}
        onChange={vi.fn()}
        defaultOpen
      />,
    )
    expect(screen.getByLabelText(/vehicle service/i)).toBeInTheDocument()
  })

  it('emits a change when a base shift is selected', () => {
    const onChange = vi.fn()
    render(<DayCard entry={emptyDay} rates={rates} onChange={onChange} defaultOpen />)
    fireEvent.click(screen.getByLabelText('Base shift'))
    expect(onChange).toHaveBeenCalledWith({ ...emptyDay, shift: 'base' })
  })

  it('emits a change when labour hours are entered', () => {
    const onChange = vi.fn()
    render(<DayCard entry={emptyDay} rates={rates} onChange={onChange} defaultOpen />)
    fireEvent.change(screen.getByLabelText(/additional labour/i), { target: { value: '2' } })
    expect(onChange).toHaveBeenCalledWith({ ...emptyDay, additionalLabourHours: 2 })
  })

  it('offers an adjusted shift option', () => {
    render(<DayCard entry={emptyDay} rates={rates} onChange={vi.fn()} defaultOpen />)
    expect(screen.getByLabelText('Adjusted shift')).toBeInTheDocument()
  })

  it('hides the adjusted shift option when the shift length is unknown', () => {
    render(
      <DayCard
        entry={emptyDay}
        rates={{ ...rates, standardDayHours: null }}
        onChange={vi.fn()}
        defaultOpen
      />,
    )
    expect(screen.queryByLabelText('Adjusted shift')).not.toBeInTheDocument()
  })

  it('reveals the hours input only once adjusted shift is chosen', () => {
    const { rerender } = render(
      <DayCard entry={emptyDay} rates={rates} onChange={vi.fn()} defaultOpen />,
    )
    expect(screen.queryByLabelText(/hours worked/i)).not.toBeInTheDocument()

    rerender(
      <DayCard
        entry={{ ...emptyDay, shift: 'adjusted' }}
        rates={rates}
        onChange={vi.fn()}
        defaultOpen
      />,
    )
    expect(screen.getByLabelText(/hours worked/i)).toBeInTheDocument()
  })

  it('clamps hours to the standard day so a short day cannot outpay a full one', () => {
    const onChange = vi.fn()
    render(
      <DayCard
        entry={{ ...emptyDay, shift: 'adjusted' }}
        rates={rates}
        onChange={onChange}
        defaultOpen
      />,
    )
    fireEvent.change(screen.getByLabelText(/hours worked/i), { target: { value: '99' } })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ adjustedHours: 11 }),
    )
  })

  it('clamps negative hours to zero', () => {
    const onChange = vi.fn()
    render(
      <DayCard
        entry={{ ...emptyDay, shift: 'adjusted' }}
        rates={rates}
        onChange={onChange}
        defaultOpen
      />,
    )
    fireEvent.change(screen.getByLabelText(/hours worked/i), { target: { value: '-3' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ adjustedHours: 0 }))
  })

  it('shows the pro-rata amount on the day badge', () => {
    render(
      <DayCard
        entry={{ ...emptyDay, shift: 'adjusted', adjustedHours: 6.5 }}
        rates={rates}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText('$251.14')).toBeInTheDocument()
  })

  it('resets hours to zero when the contractor switches away from adjusted', () => {
    const onChange = vi.fn()
    render(
      <DayCard
        entry={{ ...emptyDay, shift: 'adjusted', adjustedHours: 6.5 }}
        rates={rates}
        onChange={onChange}
        defaultOpen
      />,
    )
    fireEvent.click(screen.getByLabelText('Base shift'))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ shift: 'base', adjustedHours: 0 }),
    )
  })

  it('agrees with the fortnight total for a day mixing an adjusted shift and additional labour', () => {
    // Rounding twice is not the same operation as rounding once: this day's two
    // fractional-cent components diverge by a cent unless each is rounded the
    // way calculateFortnightly rounds its lines.
    const entry = {
      ...emptyDay,
      shift: 'adjusted' as const,
      adjustedHours: 6.5,
      additionalLabourHours: 2.5,
    }
    // The day badge is ex-GST — same as every other DayCard total assertion
    // in this file (e.g. baseShift 425 renders as "$425.00", not GST-inclusive)
    // — so it is compared against workSubtotal, not the GST-inclusive total.
    const fortnight = calculateFortnightly([entry], { amount: 0, description: '' }, rates)

    render(<DayCard entry={entry} rates={rates} onChange={vi.fn()} />)
    expect(screen.getByText(`$${fortnight.workSubtotal.toFixed(2)}`)).toBeInTheDocument()
  })
})
