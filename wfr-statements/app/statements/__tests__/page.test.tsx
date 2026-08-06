// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/airtable/contractors', () => ({ getRateCard: vi.fn() }))
vi.mock('@/lib/auth/requireContractor', () => ({ requireContractorId: vi.fn() }))

import StatementsPage from '../page'
import { getRateCard } from '@/lib/airtable/contractors'
import { requireContractorId } from '@/lib/auth/requireContractor'
import { TOOL_DISCLAIMER, TOOL_DISCLAIMER_HIGHLIGHT } from '@/lib/invoice/toolDisclaimer'
import type { RateCard } from '@/lib/rates/types'

const rates: RateCard = {
  contractorId: 'rec36VBHdVAy4XyuY',
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

afterEach(() => {
  vi.clearAllMocks()
})

describe('StatementsPage', () => {
  // The disclaimer's only job is to be seen by contractors, so "the component
  // renders correctly in isolation" is not the property that matters — "the
  // home screen carries it" is. Without this, deleting <ToolDisclaimer /> from
  // the page leaves the whole suite green.
  it('carries WFR’s disclaimer, in full, before either submission choice', async () => {
    vi.mocked(requireContractorId).mockResolvedValue('rec36VBHdVAy4XyuY')
    vi.mocked(getRateCard).mockResolvedValue(rates)

    render(await StatementsPage())

    expect(screen.getByText(TOOL_DISCLAIMER_HIGHLIGHT)).toBeInTheDocument()
    for (const paragraph of TOOL_DISCLAIMER) {
      expect(screen.getByText(paragraph)).toBeInTheDocument()
    }
  })

  it('offers both statement types and the submissions list', async () => {
    vi.mocked(requireContractorId).mockResolvedValue('rec36VBHdVAy4XyuY')
    vi.mocked(getRateCard).mockResolvedValue(rates)

    render(await StatementsPage())

    expect(screen.getByRole('link', { name: /Fortnightly Work Statement/ })).toHaveAttribute(
      'href',
      '/statements/fortnightly',
    )
    expect(
      screen.getByRole('link', { name: /Monthly Performance Bonus Statement/ }),
    ).toHaveAttribute('href', '/statements/monthly')
    expect(screen.getByRole('link', { name: /previous submissions/i })).toHaveAttribute(
      'href',
      '/statements/submissions',
    )
  })

  it('shows the contractor their own details to check before they start', async () => {
    vi.mocked(requireContractorId).mockResolvedValue('rec36VBHdVAy4XyuY')
    vi.mocked(getRateCard).mockResolvedValue(rates)

    render(await StatementsPage())

    expect(screen.getByText('HARLEY GATT')).toBeInTheDocument()
    expect(screen.getByText('12 345 678 901')).toBeInTheDocument()
  })
})
