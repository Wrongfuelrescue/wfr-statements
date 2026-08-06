import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ExceptionRow } from '@/lib/manage/exceptions'
import { ExceptionList } from '../ExceptionList'

const row: ExceptionRow = {
  kind: 'warnings',
  title: 'Supporting evidence missing',
  statementId: 'recSTATEMENT00001',
  subject: 'PATRICK HUTCHINSON — 2026-07-20 to 2026-08-02',
  detail: 'PDF attach failed',
  fix: 'Ask the contractor to re-send it.',
}

describe('ExceptionList', () => {
  it('renders the title, subject, detail and fix', () => {
    render(<ExceptionList rows={[row]} />)
    expect(screen.getByText('Supporting evidence missing')).toBeInTheDocument()
    expect(screen.getByText(/PATRICK HUTCHINSON/)).toBeInTheDocument()
    expect(screen.getByText('PDF attach failed')).toBeInTheDocument()
    expect(screen.getByText(/Ask the contractor to re-send it\./)).toBeInTheDocument()
  })

  it('links to the statement when there is one', () => {
    render(<ExceptionList rows={[row]} />)
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/manage/statements/recSTATEMENT00001',
    )
  })

  it('renders a roster-level exception without a link', () => {
    render(
      <ExceptionList
        rows={[{ ...row, kind: 'no-abn', title: 'No ABN on file', statementId: null }]}
      />,
    )
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('No ABN on file')).toBeInTheDocument()
  })

  /** The expected state most weeks — say so rather than showing a blank page. */
  it('shows an all-clear state when there is nothing wrong', () => {
    render(<ExceptionList rows={[]} />)
    expect(screen.getByText(/nothing needs attention/i)).toBeInTheDocument()
  })

  it('renders every row when several are given', () => {
    render(
      <ExceptionList
        rows={[row, { ...row, kind: 'superseded', title: 'Superseded', statementId: 'recB' }]}
      />,
    )
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })
})
