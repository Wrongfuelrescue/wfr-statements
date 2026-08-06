import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SignOutButton } from '../SignOutButton'

describe('SignOutButton', () => {
  const originalLocation = window.location

  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: '' },
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    })
    vi.restoreAllMocks()
  })

  it('posts to the logout route and sends the contractor to the sign-in page', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    render(<SignOutButton />)
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(fetchMock).toHaveBeenCalledWith('/api/logout', { method: 'POST' })
    expect(window.location.href).toBe('/')
  })

  it('still leaves for the sign-in page when the request fails', async () => {
    // The cookie may survive, in which case the contractor is redirected
    // straight back. That is honest; claiming they are signed out is not.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    render(<SignOutButton />)
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(window.location.href).toBe('/')
  })
})
