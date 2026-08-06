// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/airtable/statements', () => ({ listStatementsForContractor: vi.fn() }))
vi.mock('@/lib/auth/requireContractor', () => ({ requireContractorId: vi.fn() }))

import SubmissionsPage from '../page'
import { listStatementsForContractor } from '@/lib/airtable/statements'
import { requireContractorId } from '@/lib/auth/requireContractor'

afterEach(() => {
  vi.clearAllMocks()
})

describe('SubmissionsPage', () => {
  it('shows a download link and the contractor’s own invoice number for a statement with a stored PDF', async () => {
    vi.mocked(requireContractorId).mockResolvedValue('rec36VBHdVAy4XyuY')
    vi.mocked(listStatementsForContractor).mockResolvedValue([
      {
        id: 'recNew',
        type: 'Fortnightly',
        periodStart: '2026-07-21',
        periodEnd: '2026-08-03',
        total: 512.5,
        submittedAt: '2026-08-04T00:00:00.000Z',
        reference: 'INV-ATCVEXGZ',
        contractorInvoiceNumber: 'HG-2026-014',
        pdfUrl: 'https://airtable.example/pdf/recNew.pdf',
      },
    ])

    render(await SubmissionsPage())

    // The number printed on the PDF, not the internal reference: the screen
    // and the document must not name the same statement two different ways.
    expect(screen.getByText(/HG-2026-014/)).toBeInTheDocument()
    expect(screen.queryByText(/INV-ATCVEXGZ/)).not.toBeInTheDocument()
    const link = screen.getByRole('link', { name: /download pdf/i })
    expect(link).toHaveAttribute('href', 'https://airtable.example/pdf/recNew.pdf')
  })

  it('does not render a download link for a row with no stored attachment', async () => {
    vi.mocked(requireContractorId).mockResolvedValue('rec36VBHdVAy4XyuY')
    vi.mocked(listStatementsForContractor).mockResolvedValue([
      {
        id: 'recNoAttach',
        type: 'Fortnightly',
        periodStart: '2026-06-01',
        periodEnd: '2026-06-14',
        total: 500,
        submittedAt: '2026-06-15T00:00:00.000Z',
        reference: 'INV-NOATTACH',
        contractorInvoiceNumber: 'HG-2026-009',
        pdfUrl: null,
      },
    ])

    render(await SubmissionsPage())

    expect(screen.getByText(/HG-2026-009/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /download pdf/i })).not.toBeInTheDocument()
  })

  it('falls back to the internal reference on a row with no invoice number', async () => {
    // Rows submitted before the number was collected. Showing nothing there
    // would leave a statement with no identifier at all on screen.
    vi.mocked(requireContractorId).mockResolvedValue('rec36VBHdVAy4XyuY')
    vi.mocked(listStatementsForContractor).mockResolvedValue([
      {
        id: 'recLegacy',
        type: 'Fortnightly',
        periodStart: '2026-05-04',
        periodEnd: '2026-05-17',
        total: 425,
        submittedAt: '2026-05-18T00:00:00.000Z',
        reference: 'INV-LEGACY22',
        contractorInvoiceNumber: '',
        pdfUrl: null,
      },
    ])

    render(await SubmissionsPage())

    expect(screen.getByText(/INV-LEGACY22/)).toBeInTheDocument()
  })

  it('shows the empty state when there are no submissions', async () => {
    vi.mocked(requireContractorId).mockResolvedValue('rec36VBHdVAy4XyuY')
    vi.mocked(listStatementsForContractor).mockResolvedValue([])

    render(await SubmissionsPage())

    expect(screen.getByText(/have not submitted any statements/i)).toBeInTheDocument()
  })
})
