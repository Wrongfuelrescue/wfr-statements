import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ContractorDetails } from '../ContractorDetails'
import type { RateCard } from '@/lib/rates/types'

const rates: RateCard = {
  contractorId: 'recAAAAAAAAAAAAAA',
  name: 'HARLEY GATT',
  abn: '12 345 678 901',
  address: '1 Example Street, Perth WA 6000',
  bankAccount: '123456789',
  bankBsb: '086-006',
  standardDayHours: 11,
  van: 'VAN 1',
  city: 'Perth',
  shiftPattern: 'Week on / Week off',
  gstRegistered: true,
  baseShift: 425,
  additionalLabour: 55,
  rosteredDayOff: 212.5,
  minorService: 100,
  majorService: 200,
  googleReviewBonus: 20,
  fuelFilter30: 30,
  fuelFilter70: 70,
}

describe('ContractorDetails', () => {
  it('shows the details a contractor needs to check before submitting', () => {
    render(<ContractorDetails rates={rates} />)
    expect(screen.getByText('1 Example Street, Perth WA 6000')).toBeInTheDocument()
    expect(screen.getByText('12 345 678 901')).toBeInTheDocument()
    expect(screen.getByText('086-006')).toBeInTheDocument()
    expect(screen.getByText('123456789')).toBeInTheDocument()
  })

  it('prompts rather than showing a blank line when a detail is missing', () => {
    render(<ContractorDetails rates={{ ...rates, abn: '', bankBsb: '  ' }} />)
    expect(screen.getAllByText('Not set — contact WFR accounts')).toHaveLength(2)
  })
})
