import { createEvent, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PageNav } from '../PageNav'

afterEach(() => {
  vi.restoreAllMocks()
})

/**
 * Clicking a `<Link>` in jsdom never navigates, so the only observable
 * evidence that the guard held is that the click's default action was
 * prevented — which is exactly what stops the real navigation in a browser.
 */
function clickHome() {
  const link = screen.getByRole('link', { name: 'Return to home screen' })
  const event = createEvent.click(link)
  fireEvent(link, event)
  return event.defaultPrevented
}

describe('PageNav', () => {
  it('always offers a way back to the home screen', () => {
    render(<PageNav />)
    expect(screen.getByRole('link', { name: 'Return to home screen' })).toHaveAttribute(
      'href',
      '/statements',
    )
  })

  it('offers a back button only when there is somewhere to go back to', async () => {
    const onBack = vi.fn()
    const { rerender } = render(<PageNav />)
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()

    rerender(<PageNav onBack={onBack} />)
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalledOnce()
  })

  describe('leaving with work entered', () => {
    it('does not nag when there is nothing to lose', () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
      render(<PageNav hasUnsavedEntries={false} />)

      expect(clickHome()).toBe(false)
      expect(confirmSpy).not.toHaveBeenCalled()
    })

    it('confirms before discarding entered work', () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
      render(<PageNav hasUnsavedEntries />)

      expect(clickHome()).toBe(false)
      expect(confirmSpy).toHaveBeenCalledWith(
        'Returning to the home screen will discard everything you have entered. Continue?',
      )
    })

    it('stays on the screen when the contractor cancels the confirmation', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      render(<PageNav hasUnsavedEntries />)

      expect(clickHome()).toBe(true)
    })
  })
})
