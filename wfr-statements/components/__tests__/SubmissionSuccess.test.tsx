import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SubmissionSuccess } from '../SubmissionSuccess'
import { rollUpTotals } from '@/lib/calc/totals'

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

describe('SubmissionSuccess', () => {
  it('confirms the statement was submitted', () => {
    render(<SubmissionSuccess totals={totals} periodLabel="Tue 21 Jul – Mon 3 Aug" />)
    expect(screen.getByText(/statement submitted/i)).toBeInTheDocument()
  })

  it('points a contractor with no PDF at My submissions rather than a dead button', () => {
    // Never claims the file "has downloaded" — the app no longer downloads
    // anything on the contractor's behalf, so saying so would be a lie.
    render(<SubmissionSuccess totals={totals} periodLabel="Tue 21 Jul – Mon 3 Aug" />)
    expect(screen.getByText(/My submissions/i)).toBeInTheDocument()
    expect(screen.queryByText(/has downloaded/i)).not.toBeInTheDocument()
  })

  it('shows the period that was submitted', () => {
    render(<SubmissionSuccess totals={totals} periodLabel="Tue 21 Jul – Mon 3 Aug" />)
    expect(screen.getByText('Tue 21 Jul – Mon 3 Aug')).toBeInTheDocument()
  })

  it('still shows what was claimed, so a contractor who submitted by accident can see what went', () => {
    render(<SubmissionSuccess totals={totals} periodLabel="Tue 21 Jul – Mon 3 Aug" />)
    expect(screen.getByText('Sub Contractor Labour Hire')).toBeInTheDocument()
    expect(screen.getAllByText('$425.00').length).toBeGreaterThan(0)
  })

  it('offers the invoice as a link the contractor taps, opening in a new tab', () => {
    // target="_blank" is the whole fix for the mobile dead end: iOS Safari
    // ignores `download` on a blob: URL and navigates, so without a new tab
    // the app is torn out from under the contractor. If this attribute is
    // ever dropped, the original bug is back.
    render(
      <SubmissionSuccess
        totals={totals}
        periodLabel="21 July – 3 August 2026"
        pdfUrl="blob:https://example.test/abc"
        pdfFilename="Invoice-HARLEY-GATT-2026-08-03-INV-ABCD1234.pdf"
      />,
    )
    const link = screen.getByRole('link', { name: /open your invoice/i })
    expect(link).toHaveAttribute('href', 'blob:https://example.test/abc')
    expect(link).toHaveAttribute('download', 'Invoice-HARLEY-GATT-2026-08-03-INV-ABCD1234.pdf')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('omits the download link when there is no PDF to offer', () => {
    render(
      <SubmissionSuccess
        totals={totals}
        periodLabel="21 July – 3 August 2026"
        pdfUrl={null}
        pdfFilename=""
      />,
    )
    expect(
      screen.queryByRole('link', { name: /open your invoice/i }),
    ).not.toBeInTheDocument()
  })

  it('links back to the statements home', () => {
    render(<SubmissionSuccess totals={totals} periodLabel="Tue 21 Jul – Mon 3 Aug" />)
    const link = screen.getByRole('link', { name: /back to statements/i })
    expect(link).toHaveAttribute('href', '/statements')
  })
})
