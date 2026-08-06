import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MonthlyForm } from '../MonthlyForm'
import type { RateCard } from '@/lib/rates/types'

const rates: RateCard = {
  contractorId: 'rec1',
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

beforeEach(() => {
  vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL: vi.fn() })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function submitOneReview() {
  fireEvent.change(screen.getByLabelText(/google reviews received/i), { target: { value: '1' } })
  fireEvent.click(screen.getByRole('button', { name: /review statement/i }))
  // The declaration is unticked on every mount, and Confirm stays
  // disabled until it is given.
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: /confirm and submit/i }))
}

describe('MonthlyForm submission outcome', () => {
  it('replaces the form with a success confirmation after a successful submit, rather than resetting to a live form', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        blob: async () => new Blob(['pdf-bytes'], { type: 'application/pdf' }),
      }),
    )

    render(<MonthlyForm rates={rates} defaultMonth="2026-07" />)
    submitOneReview()

    await waitFor(() => expect(screen.getByText(/statement submitted/i)).toBeInTheDocument())
    expect(screen.getByText('Google Review Bonus')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /review statement/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to statements/i })).toHaveAttribute(
      'href',
      '/statements',
    )
  })

  it('includes the reference from the X-Statement-Reference response header in the download filename', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: (name: string) => (name === 'X-Statement-Reference' ? 'WFR-ATCVEXGZ' : null) },
        blob: async () => new Blob(['pdf-bytes'], { type: 'application/pdf' }),
      }),
    )
    const realCreateElement = document.createElement.bind(document)
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tag) => realCreateElement(tag))

    render(<MonthlyForm rates={rates} defaultMonth="2026-07" />)
    submitOneReview()

    await waitFor(() => expect(screen.getByText(/statement submitted/i)).toBeInTheDocument())
    // Several anchors get created during this render (PageNav's home links
    // among them) — the download link is the one distinguished by actually
    // having a `download` attribute set.
    const anchor = createElementSpy.mock.results.find(
      (r) => (r.value as HTMLElement).tagName === 'A' && (r.value as HTMLAnchorElement).download,
    )?.value as HTMLAnchorElement
    expect(anchor.download).toContain('WFR-ATCVEXGZ')
    createElementSpy.mockRestore()
  })

  it('never triggers the download itself, which is what stranded contractors on a phone', async () => {
    // The original bug: the app synthesised an <a download> and clicked it.
    // iOS Safari ignores `download` on a blob: URL and navigates the tab to
    // the PDF, destroying the page, so the contractor was left looking at
    // their invoice with the app gone. The remedy is that nothing here
    // clicks anything — the contractor taps the link on the success screen.
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => null },
        blob: async () => new Blob(['pdf-bytes'], { type: 'application/pdf' }),
      }),
    )

    render(<MonthlyForm rates={rates} defaultMonth="2026-07" />)
    submitOneReview()

    await waitFor(() => expect(screen.getByText(/statement submitted/i)).toBeInTheDocument())
    expect(clickSpy).not.toHaveBeenCalled()
    clickSpy.mockRestore()
  })

  it('keeps the blob URL alive so the success screen can offer the PDF again', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => null },
        blob: async () => new Blob(['pdf-bytes'], { type: 'application/pdf' }),
      }),
    )

    render(<MonthlyForm rates={rates} defaultMonth="2026-07" />)
    submitOneReview()

    await waitFor(() => expect(screen.getByText(/statement submitted/i)).toBeInTheDocument())
    const again = screen.getByRole('link', { name: /open your invoice/i })
    expect(again).toHaveAttribute('href', 'blob:fake')
    expect(again).toHaveAttribute('download', 'Invoice-HARLEY-GATT-2026-07.pdf')
    expect(again).toHaveAttribute('target', '_blank')
    // Revoking while the success screen is on display would leave the link
    // above pointing at a dead URL. It is revoked on unmount instead.
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
  })

  it('shows the success screen even when triggering the download fails, so the contractor is never stranded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => null },
        blob: async () => new Blob(['pdf-bytes'], { type: 'application/pdf' }),
      }),
    )
    // Stands in for iOS Safari navigating to the blob URL instead of saving
    // it in place: whatever the click does, the success state must already
    // have been committed before it happens.
    const realCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = realCreateElement(tag)
      if (String(tag).toLowerCase() === 'a') {
        el.click = () => {
          throw new Error('navigated away')
        }
      }
      return el
    })

    render(<MonthlyForm rates={rates} defaultMonth="2026-07" />)
    submitOneReview()

    await waitFor(() => expect(screen.getByText(/statement submitted/i)).toBeInTheDocument())
  })

  it('revokes the blob URL when the form unmounts, so it is not leaked', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => null },
        blob: async () => new Blob(['pdf-bytes'], { type: 'application/pdf' }),
      }),
    )

    const { unmount } = render(<MonthlyForm rates={rates} defaultMonth="2026-07" />)
    submitOneReview()

    await waitFor(() => expect(screen.getByText(/statement submitted/i)).toBeInTheDocument())
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake')
  })

  it('treats a 413 response as unrecoverable rather than inviting a retry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 413,
        json: async () => {
          throw new Error('not json')
        },
      }),
    )

    render(<MonthlyForm rates={rates} defaultMonth="2026-07" />)
    submitOneReview()

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByRole('alert')).not.toHaveTextContent(/try submitting again/i)
  })

  it('shows a distinct message for a non-JSON error body, not the generic network-fault message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => {
          throw new Error('not json')
        },
      }),
    )

    render(<MonthlyForm rates={rates} defaultMonth="2026-07" />)
    submitOneReview()

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByRole('alert')).not.toHaveTextContent(/entries are still here/i)
  })

  it('still shows the generic network-fault message, inviting a retry, when fetch itself throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    render(<MonthlyForm rates={rates} defaultMonth="2026-07" />)
    submitOneReview()

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByRole('alert')).toHaveTextContent(/entries are still here/i)
  })

  it('labels each fuel filter bonus with the sale price that earns it', () => {
    render(<MonthlyForm rates={rates} defaultMonth="2026-07" />)
    expect(screen.getByText(/Fuel filter sales at \$79\.50/)).toBeInTheDocument()
    expect(screen.getByText(/Fuel filter sales at \$149/)).toBeInTheDocument()
  })
})

describe('MonthlyForm invoice number', () => {
  function enterOneReviewAndReview() {
    fireEvent.change(screen.getByLabelText(/google reviews received/i), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: /review statement/i }))
  }

  it('suggests a number derived from the last day of the month', () => {
    render(<MonthlyForm rates={rates} defaultMonth="2026-07" />)
    enterOneReviewAndReview()
    expect(screen.getByLabelText(/invoice number/i)).toHaveValue('WFR-20260731')
  })

  it('keeps the number the contractor typed when they go back and change the month', () => {
    // Pinned from the first keystroke, not recomputed from the month — see
    // FortnightlyForm for why overwriting a typed number is the failure that
    // matters here.
    render(<MonthlyForm rates={rates} defaultMonth="2026-07" />)
    enterOneReviewAndReview()

    fireEvent.change(screen.getByLabelText(/invoice number/i), {
      target: { value: 'HG-2026-014' },
    })
    fireEvent.click(screen.getByRole('button', { name: /back to edit/i }))

    fireEvent.change(screen.getByLabelText(/^month$/i), { target: { value: '2026-08' } })
    fireEvent.click(screen.getByRole('button', { name: /review statement/i }))

    expect(screen.getByLabelText(/invoice number/i)).toHaveValue('HG-2026-014')
    expect(screen.getByLabelText(/invoice number/i)).not.toHaveValue('WFR-20260831')
  })

  it('keeps the suggestion in step with the month until the contractor edits it', () => {
    // A fortnightly and a monthly statement can end on the same date, and a
    // number seeded once from the default period gave both the same invoice
    // number even after the contractor moved one of them.
    render(<MonthlyForm rates={rates} defaultMonth="2026-07" />)

    fireEvent.change(screen.getByLabelText(/^month$/i), { target: { value: '2026-08' } })
    enterOneReviewAndReview()

    expect(screen.getByLabelText(/invoice number/i)).toHaveValue('WFR-20260831')
  })

  it('sends the contractor’s number with the submission', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['pdf-bytes'], { type: 'application/pdf' }),
      headers: { get: () => null },
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<MonthlyForm rates={rates} defaultMonth="2026-07" />)
    enterOneReviewAndReview()
    fireEvent.change(screen.getByLabelText(/invoice number/i), {
      target: { value: 'HG-2026-014' },
    })
    // The declaration is unticked on every mount, and Confirm stays
    // disabled until it is given.
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /confirm and submit/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const call = fetchMock.mock.calls.find(([url]) => String(url) === '/api/statements')
    const body = JSON.parse(call![1].body as string)
    expect(body.contractorInvoiceNumber).toBe('HG-2026-014')
  })
})

describe('MonthlyForm leaving the screen', () => {
  it('does not nag a contractor who has entered nothing', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<MonthlyForm rates={rates} defaultMonth="2026-07" />)
    fireEvent.click(screen.getByRole('link', { name: 'Return to home screen' }))

    expect(confirmSpy).not.toHaveBeenCalled()
  })

  it('confirms before the home link throws away entered bonuses', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<MonthlyForm rates={rates} defaultMonth="2026-07" />)
    fireEvent.change(screen.getByLabelText(/google reviews received/i), { target: { value: '2' } })

    fireEvent.click(screen.getByRole('link', { name: 'Return to home screen' }))

    expect(confirmSpy).toHaveBeenCalledOnce()
  })

  it('counts a note on its own as work worth confirming', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<MonthlyForm rates={rates} defaultMonth="2026-07" />)
    fireEvent.change(screen.getByLabelText(/note/i), { target: { value: 'Filter sold on the 3rd' } })

    fireEvent.click(screen.getByRole('link', { name: 'Return to home screen' }))

    expect(confirmSpy).toHaveBeenCalledOnce()
  })
})

describe('MonthlyForm expired session', () => {
  it('tells a signed-out contractor their entries survived, and how to get back', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Please sign in again.' }),
      }),
    )

    render(<MonthlyForm rates={rates} defaultMonth="2026-07" />)
    submitOneReview()

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    const alert = screen.getByRole('alert')
    // "Please sign in again." from the route says nothing about the entries
    // still on the screen, nor how to get back to them.
    expect(alert).toHaveTextContent(/still on this page/i)
    expect(alert).toHaveTextContent(/another tab/i)
    expect(screen.getByRole('button', { name: /confirm and submit/i })).toBeInTheDocument()
  })
})
