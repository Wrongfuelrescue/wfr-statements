// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/airtable/contractors', () => ({ getRateCard: vi.fn() }))
vi.mock('@/lib/airtable/statements', () => ({
  createStatement: vi.fn(),
  attachPdfToStatement: vi.fn(),
  attachReceiptToLine: vi.fn(),
  recordStatementWarning: vi.fn(),
  findSubmittedStatement: vi.fn(),
  statementTypeLabel: (type: 'fortnightly' | 'monthly') =>
    type === 'fortnightly' ? 'Fortnightly' : 'Monthly Bonus',
}))
vi.mock('next/headers', () => ({ cookies: vi.fn() }))

import { POST } from '../route'
import { getRateCard } from '@/lib/airtable/contractors'
import {
  createStatement,
  attachPdfToStatement,
  attachReceiptToLine,
  recordStatementWarning,
  findSubmittedStatement,
} from '@/lib/airtable/statements'
import { cookies } from 'next/headers'
import { createSessionToken } from '@/lib/auth/session'
import type { RateCard } from '@/lib/rates/types'

const rates: RateCard = {
  contractorId: 'rec36VBHdVAy4XyuY',
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

async function signedIn() {
  const token = await createSessionToken('rec36VBHdVAy4XyuY')
  vi.mocked(cookies).mockResolvedValue({
    get: () => ({ value: token }),
  } as unknown as Awaited<ReturnType<typeof cookies>>)
}

// Every real submission carries the contractor's own invoice number and a
// ticked declaration, so both are defaulted here and spread first — any test
// can still override either (or drop one, by passing it explicitly as
// undefined) to exercise its validation.
function request(body: object) {
  return new Request('http://localhost/api/statements', {
    method: 'POST',
    body: JSON.stringify({
      contractorInvoiceNumber: 'INV-001',
      declarationAccepted: true,
      ...body,
    }),
  })
}

const workedDay = {
  date: '2026-07-21',
  shift: 'base',
  additionalLabourHours: 0,
  service: 'none',
}

beforeEach(async () => {
  process.env.SESSION_SECRET = 'test-secret-at-least-32-bytes-long!!'
  vi.mocked(getRateCard).mockResolvedValue(rates)
  vi.mocked(createStatement).mockResolvedValue({
    statementId: 'recNewStatement',
    lineIds: ['recLine0', 'recLine1', 'recLine2', 'recLine3', 'recLine4'],
  })
  vi.mocked(attachPdfToStatement).mockResolvedValue(undefined)
  vi.mocked(attachReceiptToLine).mockResolvedValue(undefined)
  vi.mocked(recordStatementWarning).mockResolvedValue(undefined)
  vi.mocked(findSubmittedStatement).mockResolvedValue(null)
  await signedIn()
})

afterEach(() => {
  // Mirrors lib/auth/__tests__/login.test.ts: without this, call counts on
  // the module-level vi.fn() mocks accumulate across tests within this file,
  // which breaks toHaveBeenCalledOnce()/toHaveBeenCalledWith() assertions.
  vi.clearAllMocks()
})

describe('POST /api/statements', () => {
  it('rejects an unauthenticated request', async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: () => undefined,
    } as unknown as Awaited<ReturnType<typeof cookies>>)

    const response = await POST(request({ type: 'fortnightly', periodEnd: '2026-08-03', days: [] }))
    expect(response.status).toBe(401)
  })

  it('returns a PDF for a valid fortnightly submission', async () => {
    const response = await POST(
      request({ type: 'fortnightly', periodEnd: '2026-08-03', days: [workedDay] }),
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/pdf')
  })

  it('persists the statement before returning the PDF', async () => {
    await POST(request({ type: 'fortnightly', periodEnd: '2026-08-03', days: [workedDay] }))
    expect(createStatement).toHaveBeenCalledOnce()
    expect(attachPdfToStatement).toHaveBeenCalledWith(
      'recNewStatement',
      expect.stringContaining('.pdf'),
      expect.any(Buffer),
    )
  })

  it('uses the contractor id from the session, never from the request body', async () => {
    await POST(
      request({
        type: 'fortnightly',
        periodEnd: '2026-08-03',
        days: [workedDay],
        contractorId: 'recSOMEONE_ELSE',
      }),
    )
    expect(getRateCard).toHaveBeenCalledWith('rec36VBHdVAy4XyuY')
  })

  it('computes the fortnight start date as thirteen days before the end', async () => {
    await POST(request({ type: 'fortnightly', periodEnd: '2026-08-03', days: [workedDay] }))
    expect(vi.mocked(createStatement).mock.calls[0][0].meta).toEqual(
      expect.objectContaining({
        type: 'fortnightly',
        periodStart: '2026-07-21',
        periodEnd: '2026-08-03',
      }),
    )
  })

  it('derives the period from the ending date', async () => {
    await POST(request({ type: 'fortnightly', periodEnd: '2026-08-03', days: [workedDay] }))
    expect(vi.mocked(createStatement).mock.calls[0][0].meta).toMatchObject({
      periodStart: '2026-07-21',
      periodEnd: '2026-08-03',
    })
  })

  it('warns when a GST-registered contractor has no ABN on file', async () => {
    vi.mocked(getRateCard).mockResolvedValue({ ...rates, abn: '' })
    await POST(request({ type: 'fortnightly', periodEnd: '2026-08-03', days: [workedDay] }))
    expect(recordStatementWarning).toHaveBeenCalledWith(
      'recNewStatement',
      expect.stringMatching(/ABN/i),
    )
  })

  it('still returns the PDF when the ABN is missing', async () => {
    vi.mocked(getRateCard).mockResolvedValue({ ...rates, abn: '' })
    const response = await POST(
      request({ type: 'fortnightly', periodEnd: '2026-08-03', days: [workedDay] }),
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/pdf')
  })

  it('still warns about a missing ABN for a contractor who is not GST-registered, since 47% withholding applies regardless', async () => {
    // A supplier invoice with no ABN obliges the payer to withhold 47%
    // regardless of GST registration — so a non-registered contractor with a
    // blank ABN is also a problem invoice, just not a lost-GST-credit one.
    vi.mocked(getRateCard).mockResolvedValue({ ...rates, abn: '', gstRegistered: false })
    await POST(request({ type: 'fortnightly', periodEnd: '2026-08-03', days: [workedDay] }))
    expect(recordStatementWarning).toHaveBeenCalledWith(
      'recNewStatement',
      expect.stringMatching(/ABN/i),
    )
    const [, warning] = vi.mocked(recordStatementWarning).mock.calls[0]
    // Must not claim a lost GST credit for a contractor who isn't registered.
    expect(warning).not.toMatch(/GST credit/i)
    expect(warning).toMatch(/withhold/i)
  })

  it('mentions the lost GST credit, in addition to withholding, for a GST-registered contractor with no ABN', async () => {
    vi.mocked(getRateCard).mockResolvedValue({ ...rates, abn: '', gstRegistered: true })
    await POST(request({ type: 'fortnightly', periodEnd: '2026-08-03', days: [workedDay] }))
    const [, warning] = vi.mocked(recordStatementWarning).mock.calls[0]
    expect(warning).toMatch(/GST credit/i)
    expect(warning).toMatch(/withhold/i)
  })

  it('computes the month range for a monthly submission', async () => {
    await POST(
      request({
        type: 'monthly',
        month: '2026-07',
        bonus: { googleReviews: 4, fuelFilter30: 0, fuelFilter70: 0, note: '' },
      }),
    )
    expect(vi.mocked(createStatement).mock.calls[0][0].meta).toEqual(
      expect.objectContaining({
        type: 'monthly',
        periodStart: '2026-07-01',
        periodEnd: '2026-07-31',
      }),
    )
  })

  describe('statement reference', () => {
    it('generates a reference before persisting, and carries it through to createStatement, the PDF filename and a response header', async () => {
      const response = await POST(
        request({ type: 'fortnightly', periodEnd: '2026-08-03', days: [workedDay] }),
      )

      const meta = vi.mocked(createStatement).mock.calls[0][0].meta
      expect(meta.reference).toMatch(/^INV-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/)
      expect(typeof meta.submittedAt).toBe('string')
      expect(Number.isNaN(Date.parse(meta.submittedAt))).toBe(false)

      expect(response.headers.get('X-Statement-Reference')).toBe(meta.reference)
      expect(response.headers.get('content-disposition')).toContain(meta.reference)
    })

    it('uses the same reference for the PDF filename, the createStatement call and the response header', async () => {
      const response = await POST(
        request({ type: 'fortnightly', periodEnd: '2026-08-03', days: [workedDay] }),
      )
      const reference = response.headers.get('X-Statement-Reference')

      expect(attachPdfToStatement).toHaveBeenCalledWith(
        'recNewStatement',
        expect.stringContaining(reference as string),
        expect.any(Buffer),
      )
    })

    it('generates a fresh reference for a monthly submission too', async () => {
      const response = await POST(
        request({
          type: 'monthly',
          month: '2026-07',
          bonus: { googleReviews: 4, fuelFilter30: 0, fuelFilter70: 0, note: '' },
        }),
      )
      expect(response.headers.get('X-Statement-Reference')).toMatch(
        /^INV-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/,
      )
    })
  })

  it('rejects a zero-value statement', async () => {
    const response = await POST(
      request({ type: 'fortnightly', periodEnd: '2026-08-03', days: [] }),
    )
    expect(response.status).toBe(400)
    expect((await response.json()).error).toMatch(/nothing to claim/i)
  })

  it('returns a readable error when a rate cannot be claimed', async () => {
    const response = await POST(
      request({
        type: 'fortnightly',
        periodEnd: '2026-08-03',
        days: [{ ...workedDay, service: 'minor' }],
      }),
    )
    expect(response.status).toBe(400)
    expect((await response.json()).error).toMatch(/not entitled/i)
  })

  it('rejects an adjusted shift day with adjustedHours omitted from the body, rather than persisting a NaN statement', async () => {
    // Not reachable from the shipped client (DayCard always sends a number),
    // but nothing between the network and persistence should reject an
    // undefined adjustedHours other than this validation — undefined <= 0 is
    // false, so a naive guard would let it through and (undefined / 11) * 425
    // becomes NaN, which JSON.stringify writes as null into Airtable.
    const adjustedDayNoHours = {
      date: '2026-07-21',
      shift: 'adjusted',
      additionalLabourHours: 0,
      service: 'none',
    }
    const response = await POST(
      request({ type: 'fortnightly', periodEnd: '2026-08-03', days: [adjustedDayNoHours] }),
    )
    expect(response.status).toBe(400)
    expect(createStatement).not.toHaveBeenCalled()
  })

  it('rejects an unknown statement type', async () => {
    const response = await POST(request({ type: 'weekly' }))
    expect(response.status).toBe(400)
  })

  const reimbursement = { amount: 45, description: 'Car wash' }
  // calculateFortnightly emits lines in this order for a day carrying a base
  // shift plus the fortnight-level reimbursement: Sub Contractor Labour Hire
  // first, then Reimbursement last — so lineIds[1] is the one
  // attachReceiptToLine must receive, not lineIds[0].
  const validReceipt = { filename: 'receipt.jpg', contentType: 'image/jpeg', data: 'ZmFrZQ==' }

  it('uploads a receipt to the fortnight reimbursement line', async () => {
    await POST(
      request({
        type: 'fortnightly',
        periodEnd: '2026-08-03',
        days: [workedDay],
        reimbursement,
        receipt: validReceipt,
      }),
    )

    expect(attachReceiptToLine).toHaveBeenCalledOnce()
    expect(attachReceiptToLine).toHaveBeenCalledWith(
      'recLine1',
      'receipt.jpg',
      'image/jpeg',
      'ZmFrZQ==',
    )
  })

  it('a reimbursement with no receipt still submits cleanly', async () => {
    // ABN present so this test isolates receipt behaviour from the separate
    // missing-ABN warning covered under "GST-registered contractor" above.
    vi.mocked(getRateCard).mockResolvedValue({ ...rates, abn: '11 222 333 444' })

    const response = await POST(
      request({
        type: 'fortnightly',
        periodEnd: '2026-08-03',
        days: [workedDay],
        reimbursement,
      }),
    )

    expect(response.status).toBe(200)
    expect(attachReceiptToLine).not.toHaveBeenCalled()
    expect(recordStatementWarning).not.toHaveBeenCalled()
  })

  it('still returns 200 with the PDF and records a warning when a receipt upload fails', async () => {
    vi.mocked(attachReceiptToLine).mockRejectedValue(new Error('Receipt upload failed (500): boom'))

    const response = await POST(
      request({
        type: 'fortnightly',
        periodEnd: '2026-08-03',
        days: [workedDay],
        reimbursement,
        receipt: validReceipt,
      }),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/pdf')
    expect(recordStatementWarning).toHaveBeenCalledOnce()
    const [warnedId, warning] = vi.mocked(recordStatementWarning).mock.calls[0]
    expect(warnedId).toBe('recNewStatement')
    expect(warning).toMatch(/receipt/i)
  })

  it('rejects a non-image receipt server-side and records a warning rather than failing the submission', async () => {
    const response = await POST(
      request({
        type: 'fortnightly',
        periodEnd: '2026-08-03',
        days: [workedDay],
        reimbursement,
        receipt: { filename: 'receipt.pdf', contentType: 'application/pdf', data: 'ZmFrZQ==' },
      }),
    )

    expect(response.status).toBe(200)
    expect(attachReceiptToLine).not.toHaveBeenCalled()
    expect(recordStatementWarning).toHaveBeenCalledOnce()
    const [, warning] = vi.mocked(recordStatementWarning).mock.calls[0]
    expect(warning).toMatch(/image/i)
  })

  it('rejects an oversized receipt server-side and records a warning rather than failing the submission', async () => {
    // ~2.06 MB decoded, over the ~2 MB server-side cap.
    const oversizedData = Buffer.alloc(2.1 * 1024 * 1024, 'a').toString('base64')

    const response = await POST(
      request({
        type: 'fortnightly',
        periodEnd: '2026-08-03',
        days: [workedDay],
        reimbursement,
        receipt: { filename: 'receipt.jpg', contentType: 'image/jpeg', data: oversizedData },
      }),
    )

    expect(response.status).toBe(200)
    expect(attachReceiptToLine).not.toHaveBeenCalled()
    expect(recordStatementWarning).toHaveBeenCalledOnce()
    const [, warning] = vi.mocked(recordStatementWarning).mock.calls[0]
    expect(warning).toMatch(/large|size/i)
  })

  it('records a PDF-attach failure as a warning', async () => {
    vi.mocked(attachPdfToStatement).mockRejectedValue(new Error('PDF upload failed (503): boom'))

    const response = await POST(
      request({ type: 'fortnightly', periodEnd: '2026-08-03', days: [workedDay] }),
    )

    expect(response.status).toBe(200)
    expect(recordStatementWarning).toHaveBeenCalledOnce()
    const [warnedId, warning] = vi.mocked(recordStatementWarning).mock.calls[0]
    expect(warnedId).toBe('recNewStatement')
    expect(warning).toMatch(/PDF/i)
  })

  describe('malformed receipt payloads', () => {
    // The Body type gives no runtime guarantee — request.json() is entirely
    // client-controlled, so a null/missing-field/wrong-type receipt must be
    // rejected as a warning before any property on it is touched. By this
    // point in the request the statement is already persisted and Submitted;
    // a thrown TypeError here would surface as a failed submission for a
    // statement that actually went through, inviting a duplicate resubmit.

    it('rejects a null receipt as a warning and still returns 200 with the PDF', async () => {
      const response = await POST(
        request({
          type: 'fortnightly',
          periodEnd: '2026-08-03',
          days: [workedDay],
          reimbursement,
          receipt: null,
        }),
      )

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('application/pdf')
      expect(attachReceiptToLine).not.toHaveBeenCalled()
      expect(recordStatementWarning).toHaveBeenCalledOnce()
      const [warnedId, warning] = vi.mocked(recordStatementWarning).mock.calls[0]
      expect(warnedId).toBe('recNewStatement')
      expect(warning).toMatch(/receipt/i)
    })

    it('rejects a receipt missing contentType as a warning and still returns 200 with the PDF', async () => {
      const response = await POST(
        request({
          type: 'fortnightly',
          periodEnd: '2026-08-03',
          days: [workedDay],
          reimbursement,
          receipt: { filename: 'receipt.jpg', data: 'ZmFrZQ==' },
        }),
      )

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('application/pdf')
      expect(attachReceiptToLine).not.toHaveBeenCalled()
      expect(recordStatementWarning).toHaveBeenCalledOnce()
    })

    it('rejects a receipt missing data as a warning and still returns 200 with the PDF', async () => {
      const response = await POST(
        request({
          type: 'fortnightly',
          periodEnd: '2026-08-03',
          days: [workedDay],
          reimbursement,
          receipt: { filename: 'receipt.jpg', contentType: 'image/jpeg' },
        }),
      )

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('application/pdf')
      expect(attachReceiptToLine).not.toHaveBeenCalled()
      expect(recordStatementWarning).toHaveBeenCalledOnce()
    })

    it('rejects a receipt whose contentType is a non-string as a warning rather than throwing', async () => {
      const response = await POST(
        request({
          type: 'fortnightly',
          periodEnd: '2026-08-03',
          days: [workedDay],
          reimbursement,
          receipt: { filename: 'receipt.jpg', contentType: 123, data: 'ZmFrZQ==' },
        }),
      )

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('application/pdf')
      expect(attachReceiptToLine).not.toHaveBeenCalled()
      expect(recordStatementWarning).toHaveBeenCalledOnce()
    })
  })

  describe('duplicate submission rejection', () => {
    it('rejects a fortnightly submission with 409 when a Submitted statement already exists for the same period', async () => {
      vi.mocked(findSubmittedStatement).mockResolvedValue({ id: 'recExisting' })

      const response = await POST(
        request({ type: 'fortnightly', periodEnd: '2026-08-03', days: [workedDay] }),
      )

      expect(response.status).toBe(409)
      const body = await response.json()
      expect(body.error).toMatch(/already been submitted/i)
      expect(body.error).toMatch(/my submissions/i)
      expect(createStatement).not.toHaveBeenCalled()
    })

    it('rejects a monthly submission with 409 when a Submitted statement already exists for the same period', async () => {
      vi.mocked(findSubmittedStatement).mockResolvedValue({ id: 'recExisting' })

      const response = await POST(
        request({
          type: 'monthly',
          month: '2026-07',
          bonus: { googleReviews: 4, fuelFilter30: 0, fuelFilter70: 0, note: '' },
        }),
      )

      expect(response.status).toBe(409)
      expect(createStatement).not.toHaveBeenCalled()
    })

    it('checks for a duplicate using the contractor, statement type, and period start', async () => {
      await POST(request({ type: 'fortnightly', periodEnd: '2026-08-03', days: [workedDay] }))
      expect(findSubmittedStatement).toHaveBeenCalledWith(
        'rec36VBHdVAy4XyuY',
        'Fortnightly',
        '2026-07-21',
      )
    })

    it('proceeds to create the statement when no duplicate exists', async () => {
      vi.mocked(findSubmittedStatement).mockResolvedValue(null)
      const response = await POST(
        request({ type: 'fortnightly', periodEnd: '2026-08-03', days: [workedDay] }),
      )
      expect(response.status).toBe(200)
      expect(createStatement).toHaveBeenCalledOnce()
    })

    it('returns a clean 500 rather than a raw error when the duplicate check itself fails', async () => {
      vi.mocked(findSubmittedStatement).mockRejectedValue(new Error('Airtable request failed (503): boom'))
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      const response = await POST(
        request({ type: 'fortnightly', periodEnd: '2026-08-03', days: [workedDay] }),
      )

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.error).not.toMatch(/503|boom/)
      expect(createStatement).not.toHaveBeenCalled()
      consoleError.mockRestore()
    })
  })

  describe('request validation', () => {
    it('rejects a malformed periodEnd with a clean 400 rather than an internal error message', async () => {
      const response = await POST(
        request({ type: 'fortnightly', periodEnd: 'not-a-date', days: [workedDay] }),
      )
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).not.toMatch(/cannot read propert/i)
      expect(body.error).toMatch(/does not look right/i)
    })

    it('rejects a missing periodEnd with a clean 400 rather than crashing on undefined', async () => {
      const response = await POST(request({ type: 'fortnightly', days: [workedDay] }))
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).not.toMatch(/cannot read propert/i)
    })

    it('rejects a malformed month with a clean 400 rather than an internal error message', async () => {
      const response = await POST(
        request({
          type: 'monthly',
          month: 'not-a-month',
          bonus: { googleReviews: 1, fuelFilter30: 0, fuelFilter70: 0, note: '' },
        }),
      )
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).not.toMatch(/cannot read propert/i)
      expect(body.error).toMatch(/does not look right/i)
    })

    it('rejects a day whose date falls outside the stated fortnight', async () => {
      const response = await POST(
        request({
          type: 'fortnightly',
          periodEnd: '2026-08-03',
          days: [{ ...workedDay, date: '2026-09-01' }],
        }),
      )
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toMatch(/outside the selected fortnight/i)
      expect(createStatement).not.toHaveBeenCalled()
    })

    it('rejects a fortnightly submission with a duplicated day', async () => {
      const response = await POST(
        request({
          type: 'fortnightly',
          periodEnd: '2026-08-03',
          days: [workedDay, workedDay],
        }),
      )
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toMatch(/more than once/i)
    })

    it('rejects additional labour hours over the 24-hour daily ceiling', async () => {
      const response = await POST(
        request({
          type: 'fortnightly',
          periodEnd: '2026-08-03',
          days: [{ ...workedDay, additionalLabourHours: 25 }],
        }),
      )
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toMatch(/cannot exceed/i)
    })

    it('rejects a blank contractor invoice number, whatever the client allowed through', async () => {
      const response = await POST(
        request({
          type: 'fortnightly',
          periodEnd: '2026-08-03',
          days: [workedDay],
          contractorInvoiceNumber: '   ',
        }),
      )
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toMatch(/invoice number/i)
      expect(createStatement).not.toHaveBeenCalled()
    })

    it('rejects a submission with no contractor invoice number at all', async () => {
      const response = await POST(
        request({
          type: 'fortnightly',
          periodEnd: '2026-08-03',
          days: [workedDay],
          contractorInvoiceNumber: undefined,
        }),
      )
      expect(response.status).toBe(400)
      expect(createStatement).not.toHaveBeenCalled()
    })

    it('carries the trimmed contractor invoice number through to the persisted statement', async () => {
      await POST(
        request({
          type: 'fortnightly',
          periodEnd: '2026-08-03',
          days: [workedDay],
          contractorInvoiceNumber: '  HG-2026-014  ',
        }),
      )
      expect(vi.mocked(createStatement).mock.calls[0][0].meta).toMatchObject({
        contractorInvoiceNumber: 'HG-2026-014',
      })
    })

    it('rejects a submission whose declaration was not accepted, before anything is persisted', async () => {
      const response = await POST(
        request({
          type: 'fortnightly',
          periodEnd: '2026-08-03',
          days: [workedDay],
          declarationAccepted: false,
        }),
      )
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toMatch(/declaration/i)
      // A 400 raised after persistence would leave an orphan Submitted
      // statement the contractor was told had failed.
      expect(createStatement).not.toHaveBeenCalled()
    })

    it('rejects a submission with no declaration at all', async () => {
      const response = await POST(
        request({
          type: 'fortnightly',
          periodEnd: '2026-08-03',
          days: [workedDay],
          declarationAccepted: undefined,
        }),
      )
      expect(response.status).toBe(400)
      expect(createStatement).not.toHaveBeenCalled()
    })

    it('rejects a merely truthy declaration, which nobody actually ticked', async () => {
      for (const declarationAccepted of ['true', 1]) {
        vi.mocked(createStatement).mockClear()
        const response = await POST(
          request({
            type: 'fortnightly',
            periodEnd: '2026-08-03',
            days: [workedDay],
            declarationAccepted,
          }),
        )
        expect(response.status).toBe(400)
        expect(createStatement).not.toHaveBeenCalled()
      }
    })

    it('records the acceptance at the same instant the invoice is dated', async () => {
      await POST(request({ type: 'fortnightly', periodEnd: '2026-08-03', days: [workedDay] }))
      const meta = vi.mocked(createStatement).mock.calls[0][0].meta
      // The one instant generated before the PDF renders — never a second,
      // slightly later `new Date()`, which would put the acceptance and the
      // invoice date minutes apart on the same document.
      expect(meta.declarationAcceptedAt).toBe(meta.submittedAt)
    })

    it('records the acceptance on a monthly submission too', async () => {
      await POST(
        request({
          type: 'monthly',
          month: '2026-07',
          bonus: { googleReviews: 4, fuelFilter30: 0, fuelFilter70: 0, note: '' },
        }),
      )
      const meta = vi.mocked(createStatement).mock.calls[0][0].meta
      expect(meta.declarationAcceptedAt).toBe(meta.submittedAt)
    })

    it('rejects a reimbursement amount over the $10,000 ceiling', async () => {
      const response = await POST(
        request({
          type: 'fortnightly',
          periodEnd: '2026-08-03',
          days: [workedDay],
          reimbursement: { amount: 10_001, description: 'Very large expense' },
        }),
      )
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toMatch(/limit/i)
    })
  })
})
