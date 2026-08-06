// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/airtable/contractors', () => ({ getRateCard: vi.fn() }))
vi.mock('@/lib/auth/requireContractor', () => ({ requireContractorId: vi.fn() }))

import MonthlyPage from '../page'
import { getRateCard } from '@/lib/airtable/contractors'
import { requireContractorId } from '@/lib/auth/requireContractor'
import type { RateCard } from '@/lib/rates/types'

const rates: RateCard = {
  contractorId: 'rec36VBHdVAy4XyuY',
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

afterEach(() => {
  vi.clearAllMocks()
})

describe('MonthlyPage no-ABN warning', () => {
  it('shows a warning banner above the form when the contractor has no ABN on file', async () => {
    vi.mocked(requireContractorId).mockResolvedValue('rec36VBHdVAy4XyuY')
    vi.mocked(getRateCard).mockResolvedValue({ ...rates, abn: '' })

    render(await MonthlyPage())

    expect(screen.getByText(/hasn't added your ABN yet/i)).toBeInTheDocument()
  })

  it('does not show the warning once the contractor has an ABN on file', async () => {
    vi.mocked(requireContractorId).mockResolvedValue('rec36VBHdVAy4XyuY')
    vi.mocked(getRateCard).mockResolvedValue({ ...rates, abn: '11 222 333 444' })

    render(await MonthlyPage())

    expect(screen.queryByText(/hasn't added your ABN yet/i)).not.toBeInTheDocument()
  })
})
