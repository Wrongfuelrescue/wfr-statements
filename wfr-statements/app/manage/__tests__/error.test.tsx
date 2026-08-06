import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ManageError from '../error'

describe('ManageError', () => {
  it('says the page failed rather than showing nothing', () => {
    render(<ManageError error={new Error('Airtable request failed (401)')} retry={vi.fn()} />)
    expect(screen.getByText('This page could not be loaded')).toBeInTheDocument()
  })

  /**
   * The point of the boundary: a zero on a pay-run screen that actually means
   * "the fetch failed" is the most expensive possible way to be wrong.
   */
  it('warns against reading a missing figure as a zero', () => {
    render(<ManageError error={new Error('boom')} retry={vi.fn()} />)
    expect(screen.getByText(/do not treat a missing figure as a zero/i)).toBeInTheDocument()
  })

  it('never shows the raw error text, which can carry an Airtable response body', () => {
    const { container } = render(
      <ManageError error={new Error('pat_secret_token_leaked')} retry={vi.fn()} />,
    )
    expect(container.textContent).not.toContain('pat_secret_token_leaked')
  })

  /** retry() re-fetches; reset() would redisplay the same error. */
  it('calls retry when the button is pressed', () => {
    const retry = vi.fn()
    render(<ManageError error={new Error('boom')} retry={retry} />)
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(retry).toHaveBeenCalledOnce()
  })
})
