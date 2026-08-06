import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FortnightlyForm } from '../FortnightlyForm'
import type { RateCard } from '@/lib/rates/types'

const { processReceiptFile } = vi.hoisted(() => ({ processReceiptFile: vi.fn() }))
vi.mock('@/lib/receipts/downscale', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/receipts/downscale')>('@/lib/receipts/downscale')
  return { ...actual, processReceiptFile }
})

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

const receipt = { filename: 'receipt.jpg', contentType: 'image/jpeg', data: 'ZmFrZQ==' }

function attachReceipt() {
  fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '45' } })
  fireEvent.change(screen.getByLabelText(/what was it for/i), { target: { value: 'Car wash' } })
  const file = new File(['fake'], 'photo.jpg', { type: 'image/jpeg' })
  fireEvent.change(screen.getByLabelText(/receipt photo/i), { target: { files: [file] } })
}

/**
 * The form also mounts <SessionHeartbeat />, which pings /api/session/touch on
 * the contractor's first real interaction. That is a genuine second caller of
 * the global fetch, so assertions about submitting must look at the statement
 * request specifically rather than at the raw call count.
 */
function statementCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([url]) => String(url) === '/api/statements')
}

beforeEach(() => {
  processReceiptFile.mockReset().mockResolvedValue(receipt)
  vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL: vi.fn() })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('FortnightlyForm reimbursement and receipt', () => {
  it('includes the reimbursement and receipt in the submit payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['pdf-bytes'], { type: 'application/pdf' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<FortnightlyForm rates={rates} defaultEnd="2026-08-03" />)
    attachReceipt()
    await waitFor(() => expect(screen.getByText(/attached: receipt\.jpg/i)).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /review statement/i }))
    // The declaration is unticked on every mount, and Confirm stays
    // disabled until it is given.
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /confirm and submit/i }))

    await waitFor(() => expect(statementCalls(fetchMock)).toHaveLength(1))
    const [, init] = statementCalls(fetchMock)[0]
    const body = JSON.parse(init.body as string)
    expect(body.reimbursement).toEqual({ amount: 45, description: 'Car wash' })
    expect(body.receipt).toEqual(receipt)
    expect(body.periodEnd).toBe('2026-08-03')
    // Strictly true — the route rejects anything else.
    expect(body.declarationAccepted).toBe(true)
  })

  it('mounts the review screen with the declaration unticked and Confirm blocked', () => {
    render(<FortnightlyForm rates={rates} defaultEnd="2026-08-03" />)
    fireEvent.click(screen.getByText('Tue 21 Jul'))
    fireEvent.click(screen.getByLabelText('Base shift'))
    fireEvent.click(screen.getByRole('button', { name: /review statement/i }))

    expect(screen.getByRole('checkbox')).not.toBeChecked()
    expect(screen.getByRole('button', { name: /confirm and submit/i })).toBeDisabled()
  })

  it('drops the receipt from state when the reimbursement amount returns to zero', async () => {
    render(<FortnightlyForm rates={rates} defaultEnd="2026-08-03" />)
    attachReceipt()
    await waitFor(() => expect(screen.getByText(/attached: receipt\.jpg/i)).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '45' } })

    expect(screen.queryByText(/attached: receipt\.jpg/i)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/receipt photo/i)).toBeInTheDocument()
  })

  it('disables the review button while a receipt is being processed, and re-enables it once done', async () => {
    let resolveProcessing: (value: typeof receipt) => void = () => {}
    processReceiptFile.mockReturnValue(
      new Promise((resolve) => {
        resolveProcessing = resolve
      }),
    )

    render(<FortnightlyForm rates={rates} defaultEnd="2026-08-03" />)
    attachReceipt()

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /review statement/i })).toBeDisabled(),
    )

    resolveProcessing(receipt)

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /review statement/i })).not.toBeDisabled(),
    )
  })

  it('refuses to submit, with an actionable message, when the receipt payload is too large', async () => {
    // Resolves rather than returning undefined: the heartbeat shares this
    // global and treats fetch's return value as a promise, exactly as a
    // browser would.
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob([]) })
    vi.stubGlobal('fetch', fetchSpy)

    processReceiptFile.mockResolvedValue({
      filename: 'huge.jpg',
      contentType: 'image/jpeg',
      data: 'a'.repeat(5 * 1024 * 1024),
    })

    render(<FortnightlyForm rates={rates} defaultEnd="2026-08-03" />)
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '45' } })
    fireEvent.change(screen.getByLabelText(/what was it for/i), { target: { value: 'Car wash' } })
    const file = new File(['fake'], 'huge.jpg', { type: 'image/jpeg' })
    fireEvent.change(screen.getByLabelText(/receipt photo/i), { target: { files: [file] } })
    await waitFor(() => expect(screen.getByText(/attached: huge\.jpg/i)).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /review statement/i }))
    // The declaration is unticked on every mount, and Confirm stays
    // disabled until it is given.
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /confirm and submit/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByRole('alert')).toHaveTextContent(/too large to submit/i)
    expect(statementCalls(fetchSpy)).toHaveLength(0)
  })

  // Coverage gap 1 (carried over from Task 4's removed per-day receipt
  // tests): a rejected processReceiptFile must surface a readable error and
  // attach nothing. The async downscaling lives in the parent form, not in
  // the now-stateless ReimbursementSection, so this is exercised here.
  it('shows a readable error and attaches nothing when receipt processing fails', async () => {
    processReceiptFile.mockRejectedValue(new Error('boom'))

    render(<FortnightlyForm rates={rates} defaultEnd="2026-08-03" />)
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '45' } })
    fireEvent.change(screen.getByLabelText(/what was it for/i), { target: { value: 'Car wash' } })
    const file = new File(['fake'], 'photo.jpg', { type: 'image/jpeg' })
    fireEvent.change(screen.getByLabelText(/receipt photo/i), { target: { files: [file] } })

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByRole('alert')).toHaveTextContent(/could not process this photo/i)
    expect(screen.queryByText(/attached:/i)).not.toBeInTheDocument()
  })
})

describe('FortnightlyForm incomplete reimbursement gating', () => {
  it('disables Review while a reimbursement has an amount but no description', () => {
    render(<FortnightlyForm rates={rates} defaultEnd="2026-08-03" />)
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '45' } })

    expect(screen.getByRole('button', { name: /review statement/i })).toBeDisabled()
  })

  it('shows an inline message while a reimbursement is incomplete', () => {
    render(<FortnightlyForm rates={rates} defaultEnd="2026-08-03" />)
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '45' } })

    expect(screen.getByRole('alert')).toHaveTextContent(/what.*for/i)
  })

  it('re-enables Review once a description is filled in', () => {
    render(<FortnightlyForm rates={rates} defaultEnd="2026-08-03" />)
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '45' } })
    expect(screen.getByRole('button', { name: /review statement/i })).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/what was it for/i), { target: { value: 'Car wash' } })
    expect(screen.getByRole('button', { name: /review statement/i })).not.toBeDisabled()
  })
})

describe('FortnightlyForm incomplete adjusted-shift gating', () => {
  it('excludes only the incomplete day from the running total rather than zeroing the whole fortnight', () => {
    // calculateFortnightly throws for an adjusted shift with no hours.
    // FortnightlyForm's useMemo previously caught that and fell back to an
    // *empty* calculation — dropping every other day's total to $0.00, not
    // just the broken one.
    render(<FortnightlyForm rates={rates} defaultEnd="2026-08-03" />)

    fireEvent.click(screen.getByText('Tue 21 Jul'))
    fireEvent.click(screen.getByLabelText('Base shift'))
    fireEvent.click(screen.getByText('Tue 21 Jul')) // collapse before opening the next card

    fireEvent.click(screen.getByText('Mon 3 Aug'))
    fireEvent.click(screen.getByLabelText('Adjusted shift'))

    // 425 + 10% GST = 467.50 — the valid day's total must survive.
    expect(screen.getAllByText('$467.50').length).toBeGreaterThan(0)
  })

  it('shows an inline alert naming the date of an adjusted shift missing its hours', () => {
    render(<FortnightlyForm rates={rates} defaultEnd="2026-08-03" />)
    fireEvent.click(screen.getByText('Mon 3 Aug'))
    fireEvent.click(screen.getByLabelText('Adjusted shift'))

    expect(screen.getByRole('alert')).toHaveTextContent(/Mon 3 Aug/)
  })

  it('disables Review while an adjusted shift is missing its hours', () => {
    render(<FortnightlyForm rates={rates} defaultEnd="2026-08-03" />)
    fireEvent.click(screen.getByText('Tue 21 Jul'))
    fireEvent.click(screen.getByLabelText('Base shift'))
    fireEvent.click(screen.getByText('Tue 21 Jul')) // collapse before opening the next card
    fireEvent.click(screen.getByText('Mon 3 Aug'))
    fireEvent.click(screen.getByLabelText('Adjusted shift'))

    expect(screen.getByRole('button', { name: /review statement/i })).toBeDisabled()
  })

  it('re-enables Review, and clears the alert, once hours are entered', () => {
    render(<FortnightlyForm rates={rates} defaultEnd="2026-08-03" />)
    fireEvent.click(screen.getByText('Mon 3 Aug'))
    fireEvent.click(screen.getByLabelText('Adjusted shift'))
    expect(screen.getByRole('button', { name: /review statement/i })).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/hours worked/i), { target: { value: '6.5' } })

    expect(screen.getByRole('button', { name: /review statement/i })).not.toBeDisabled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('FortnightlyForm submission outcome', () => {
  function submitBaseShiftDay() {
    fireEvent.click(screen.getByText('Tue 21 Jul'))
    fireEvent.click(screen.getByLabelText('Base shift'))
    fireEvent.click(screen.getByRole('button', { name: /review statement/i }))
    // The declaration is unticked on every mount, and Confirm stays
    // disabled until it is given.
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /confirm and submit/i }))
  }

  it('replaces the form with a success confirmation after a successful submit, rather than resetting to a live form', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        blob: async () => new Blob(['pdf-bytes'], { type: 'application/pdf' }),
      }),
    )

    render(<FortnightlyForm rates={rates} defaultEnd="2026-08-03" />)
    submitBaseShiftDay()

    await waitFor(() => expect(screen.getByText(/statement submitted/i)).toBeInTheDocument())
    // The confirmation still shows what was claimed, not a reset/blank form.
    expect(screen.getByText('Sub Contractor Labour Hire')).toBeInTheDocument()
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

    render(<FortnightlyForm rates={rates} defaultEnd="2026-08-03" />)
    submitBaseShiftDay()

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

  it('keeps the blob URL alive so the success screen can offer the PDF again', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => null },
        blob: async () => new Blob(['pdf-bytes'], { type: 'application/pdf' }),
      }),
    )

    render(<FortnightlyForm rates={rates} defaultEnd="2026-08-03" />)
    submitBaseShiftDay()

    await waitFor(() => expect(screen.getByText(/statement submitted/i)).toBeInTheDocument())
    const again = screen.getByRole('link', { name: /open your invoice/i })
    expect(again).toHaveAttribute('href', 'blob:fake')
    expect(again).toHaveAttribute('download', 'Invoice-HARLEY-GATT-2026-08-03.pdf')
    expect(again).toHaveAttribute('target', '_blank')
    // Revoking while the success screen is on display would leave the link
    // above pointing at a dead URL. It is revoked on unmount instead.
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
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

    render(<FortnightlyForm rates={rates} defaultEnd="2026-08-03" />)
    submitBaseShiftDay()

    await waitFor(() => expect(screen.getByText(/statement submitted/i)).toBeInTheDocument())
    expect(clickSpy).not.toHaveBeenCalled()
    clickSpy.mockRestore()
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

    render(<FortnightlyForm rates={rates} defaultEnd="2026-08-03" />)
    submitBaseShiftDay()

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

    const { unmount } = render(<FortnightlyForm rates={rates} defaultEnd="2026-08-03" />)
    submitBaseShiftDay()

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

    render(<FortnightlyForm rates={rates} defaultEnd="2026-08-03" />)
    submitBaseShiftDay()

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByRole('alert')).toHaveTextContent(/too large to send/i)
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

    render(<FortnightlyForm rates={rates} defaultEnd="2026-08-03" />)
    submitBaseShiftDay()

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByRole('alert')).not.toHaveTextContent(/entries are still here/i)
  })

  it('still shows the generic network-fault message, inviting a retry, when fetch itself throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    render(<FortnightlyForm rates={rates} defaultEnd="2026-08-03" />)
    submitBaseShiftDay()

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByRole('alert')).toHaveTextContent(/entries are still here/i)
  })
})

describe('FortnightlyForm fortnight-ending date', () => {
  it('asks for the fortnight ending date and shows the derived range', () => {
    render(<FortnightlyForm rates={rates} defaultEnd="2026-08-03" />)
    expect(screen.getByLabelText(/fortnight ending/i)).toBeInTheDocument()
    expect(screen.getByText(/Tue 21 Jul 2026/)).toBeInTheDocument()
    expect(screen.getByText(/Mon 3 Aug 2026/)).toBeInTheDocument()
  })

  it('carries entries across an ending-date change and confirms before discarding a day with real work', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<FortnightlyForm rates={rates} defaultEnd="2026-08-03" />)
    fireEvent.click(screen.getByText('Tue 21 Jul'))
    fireEvent.click(screen.getByLabelText('Base shift'))

    // Moving the ending date one week later drops the fortnight's first
    // week — including the day just entered — so it must ask first.
    fireEvent.change(screen.getByLabelText(/fortnight ending/i), {
      target: { value: '2026-08-10' },
    })

    expect(confirmSpy).toHaveBeenCalledOnce()
    expect(screen.getByText(/Tue 28 Jul 2026/)).toBeInTheDocument()
    expect(screen.getByText(/Mon 10 Aug 2026/)).toBeInTheDocument()
  })

  it('does not ask for confirmation, and carries the entry forward, when the day stays in the new fortnight', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<FortnightlyForm rates={rates} defaultEnd="2026-08-03" />)
    // The last day of the fortnight ending 2026-08-03.
    fireEvent.click(screen.getByText('Mon 3 Aug'))
    fireEvent.click(screen.getByLabelText('Base shift'))

    // A one-day shift still keeps 2026-08-03 inside the new fortnight
    // (2026-07-22 to 2026-08-04), so nothing entered is discarded.
    fireEvent.change(screen.getByLabelText(/fortnight ending/i), {
      target: { value: '2026-08-04' },
    })

    expect(confirmSpy).not.toHaveBeenCalled()
  })

  it('leaves entries untouched when the contractor cancels the confirmation', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<FortnightlyForm rates={rates} defaultEnd="2026-08-03" />)
    fireEvent.click(screen.getByText('Tue 21 Jul'))
    fireEvent.click(screen.getByLabelText('Base shift'))

    fireEvent.change(screen.getByLabelText(/fortnight ending/i), {
      target: { value: '2026-08-10' },
    })

    // Still on the original fortnight — the change was rejected.
    expect(screen.getByText(/Tue 21 Jul 2026/)).toBeInTheDocument()
    expect(screen.getByText(/Mon 3 Aug 2026/)).toBeInTheDocument()
  })
})

describe('FortnightlyForm invoice number', () => {
  // Mon 3 Aug sits inside both the default fortnight (21 Jul – 3 Aug) and the
  // later one used below (28 Jul – 10 Aug), so changing the period carries the
  // entered day across: no discard prompt, and Review stays enabled.
  function enterLastDayAndReview() {
    fireEvent.click(screen.getByText('Mon 3 Aug'))
    fireEvent.click(screen.getByLabelText('Base shift'))
    fireEvent.click(screen.getByText('Mon 3 Aug')) // collapse
    fireEvent.click(screen.getByRole('button', { name: /review statement/i }))
  }

  it('suggests a number derived from the fortnight ending date', () => {
    render(<FortnightlyForm rates={rates} defaultEnd="2026-08-03" />)
    enterLastDayAndReview()
    expect(screen.getByLabelText(/invoice number/i)).toHaveValue('WFR-20260803')
  })

  it('keeps the number the contractor typed when they go back and change the fortnight', () => {
    // The suggestion tracks the period only until the contractor edits the
    // field; from the first keystroke it is pinned. Recomputing after an edit
    // would silently overwrite a number the contractor had already typed,
    // which for someone keeping their own sequence means submitting the wrong
    // one. The companion test above covers the other half — before any edit,
    // the suggestion must follow the period, or two fortnights submitted on
    // the same day would carry the same invoice number.
    render(<FortnightlyForm rates={rates} defaultEnd="2026-08-03" />)
    enterLastDayAndReview()

    fireEvent.change(screen.getByLabelText(/invoice number/i), {
      target: { value: 'HG-2026-014' },
    })
    fireEvent.click(screen.getByRole('button', { name: /back to edit/i }))

    fireEvent.change(screen.getByLabelText(/fortnight ending/i), {
      target: { value: '2026-08-10' },
    })
    fireEvent.click(screen.getByRole('button', { name: /review statement/i }))

    expect(screen.getByLabelText(/invoice number/i)).toHaveValue('HG-2026-014')
    expect(screen.getByLabelText(/invoice number/i)).not.toHaveValue('WFR-20260810')
  })

  it('keeps the suggestion in step with the period until the contractor edits it', () => {
    // Two fortnights submitted on the same day previously shared one
    // suggested number, because it was seeded once and never recomputed:
    // two different invoices, both reading WFR-20260830.
    render(<FortnightlyForm rates={rates} defaultEnd="2026-08-03" />)

    fireEvent.change(screen.getByLabelText(/fortnight ending/i), {
      target: { value: '2026-08-10' },
    })
    fireEvent.click(screen.getByText('Mon 10 Aug'))
    fireEvent.click(screen.getByLabelText('Base shift'))
    fireEvent.click(screen.getByText('Mon 10 Aug')) // collapse
    fireEvent.click(screen.getByRole('button', { name: /review statement/i }))

    expect(screen.getByLabelText(/invoice number/i)).toHaveValue('WFR-20260810')
  })

  it('sends the contractor’s number with the submission', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['pdf-bytes'], { type: 'application/pdf' }),
      headers: { get: () => null },
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<FortnightlyForm rates={rates} defaultEnd="2026-08-03" />)
    enterLastDayAndReview()
    fireEvent.change(screen.getByLabelText(/invoice number/i), {
      target: { value: 'HG-2026-014' },
    })
    // The declaration is unticked on every mount, and Confirm stays
    // disabled until it is given.
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /confirm and submit/i }))

    await waitFor(() => expect(statementCalls(fetchMock).length).toBe(1))
    const body = JSON.parse(statementCalls(fetchMock)[0][1].body as string)
    expect(body.contractorInvoiceNumber).toBe('HG-2026-014')
  })
})

describe('FortnightlyForm leaving the screen', () => {
  it('does not nag a contractor who has entered nothing', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<FortnightlyForm rates={rates} defaultEnd="2026-08-03" />)
    fireEvent.click(screen.getByRole('link', { name: 'Return to home screen' }))

    expect(confirmSpy).not.toHaveBeenCalled()
  })

  it('confirms before the home link throws away an entered fortnight', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<FortnightlyForm rates={rates} defaultEnd="2026-08-03" />)
    fireEvent.click(screen.getByText('Tue 21 Jul'))
    fireEvent.click(screen.getByLabelText('Base shift'))

    fireEvent.click(screen.getByRole('link', { name: 'Return to home screen' }))

    expect(confirmSpy).toHaveBeenCalledOnce()
  })

  it('counts a reimbursement on its own as work worth confirming', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<FortnightlyForm rates={rates} defaultEnd="2026-08-03" />)
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '45' } })

    fireEvent.click(screen.getByRole('link', { name: 'Return to home screen' }))

    expect(confirmSpy).toHaveBeenCalledOnce()
  })
})

describe('FortnightlyForm expired session', () => {
  it('tells a signed-out contractor their entries survived, and how to get back', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Please sign in again.' }),
      }),
    )

    render(<FortnightlyForm rates={rates} defaultEnd="2026-08-03" />)
    fireEvent.click(screen.getByText('Tue 21 Jul'))
    fireEvent.click(screen.getByLabelText('Base shift'))
    fireEvent.click(screen.getByText('Tue 21 Jul')) // collapse
    fireEvent.click(screen.getByRole('button', { name: /review statement/i }))
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /confirm and submit/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    const alert = screen.getByRole('alert')
    // The route's own "Please sign in again." says nothing about the
    // fourteen days still sitting on the screen, nor how to get back to
    // them, so it must not be what the contractor is shown.
    expect(alert).toHaveTextContent(/still on this page/i)
    expect(alert).toHaveTextContent(/another tab/i)
    // The entries really are still there — this is the claim being made.
    expect(screen.getByRole('button', { name: /confirm and submit/i })).toBeInTheDocument()
  })
})
