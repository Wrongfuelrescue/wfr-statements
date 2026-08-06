import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { PayRunRow } from '@/lib/manage/rollup'
import { statement } from '@/lib/manage/__tests__/factories'
import { PayRunTable } from '../PayRunTable'

const submitted: PayRunRow = {
  contractorId: 'recCONTRACTOR0001',
  contractorName: 'PATRICK HUTCHINSON',
  offCycle: false,
  statement: statement({ pdfUrl: 'https://example.test/a.pdf' }),
}

const outstanding: PayRunRow = {
  contractorId: 'recCONTRACTOR0002',
  contractorName: 'SIMON CAMERON',
  statement: null,
  offCycle: false,
}

describe('PayRunTable', () => {
  it('shows a submitted contractor with their total and reference', () => {
    render(<PayRunTable rows={[submitted]} />)
    expect(screen.getByText('PATRICK HUTCHINSON')).toBeInTheDocument()
    expect(screen.getByText('$1,069.99')).toBeInTheDocument()
    expect(screen.getByText('INV-MYFAAMJP')).toBeInTheDocument()
  })

  /** The outstanding list is the reason the screen exists — never an omission. */
  it('shows a contractor who has not submitted as an outstanding row', () => {
    render(<PayRunTable rows={[submitted, outstanding]} />)
    expect(screen.getByText('SIMON CAMERON')).toBeInTheDocument()
    expect(screen.getByText('Not submitted')).toBeInTheDocument()
  })

  it('links a submitted row to its statement detail', () => {
    render(<PayRunTable rows={[submitted]} />)
    expect(screen.getByRole('link', { name: 'PATRICK HUTCHINSON' })).toHaveAttribute(
      'href',
      '/manage/statements/recSTATEMENT00001',
    )
  })

  it('does not link an outstanding row anywhere', () => {
    render(<PayRunTable rows={[outstanding]} />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('badges an off-cycle statement', () => {
    render(<PayRunTable rows={[{ ...submitted, offCycle: true }]} />)
    expect(screen.getByText('Off-cycle')).toBeInTheDocument()
  })

  it('renders a missing PDF as text, not a broken link', () => {
    render(
      <PayRunTable rows={[{ ...submitted, statement: statement({ pdfUrl: null }) }]} />,
    )
    expect(screen.queryByRole('link', { name: 'PDF' })).not.toBeInTheDocument()
    expect(screen.getByText('No PDF')).toBeInTheDocument()
  })

  it('flags a statement carrying warnings', () => {
    render(
      <PayRunTable
        rows={[{ ...submitted, statement: statement({ warnings: 'PDF attach failed' }) }]}
      />,
    )
    expect(screen.getByText('Warning')).toBeInTheDocument()
  })

  it('shows an empty state when nobody is expected', () => {
    render(<PayRunTable rows={[]} />)
    expect(screen.getByText(/no contractors/i)).toBeInTheDocument()
  })
})
