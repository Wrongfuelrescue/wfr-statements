import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createStatement,
  attachPdfToStatement,
  attachReceiptToLine,
  recordStatementWarning,
  listStatementsForContractor,
  findSubmittedStatement,
  statementTypeLabel,
} from '../statements'
import { STATEMENTS_TABLE } from '../fields'
import { rollUpTotals } from '@/lib/calc/totals'
import type { RateCard } from '@/lib/rates/types'
import type { StatementLine } from '@/lib/calc/types'

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
    {
      date: '2026-07-22',
      lineType: 'Reimbursement',
      quantity: 1,
      unitRate: 45,
      amount: 45,
      description: 'Car wash',
      gstBearing: false,
    },
  ],
  true,
)

const meta = {
  type: 'fortnightly' as const,
  periodStart: '2026-07-21',
  periodEnd: '2026-08-03',
  reference: 'WFR-ATCVEXGZ',
  submittedAt: '2026-08-04T09:00:00.000Z',
  contractorInvoiceNumber: 'INV-001',
  declarationAcceptedAt: '2026-08-04T09:00:00.000Z',
}

let calls: Array<{ url: string; method: string; body: unknown }>

beforeEach(() => {
  process.env.AIRTABLE_TOKEN = 'pat_test'
  process.env.AIRTABLE_BASE_ID = 'appNMPu4UACVHBBbR'
  calls = []

  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
      const body = init.body ? JSON.parse(init.body as string) : null
      calls.push({ url, method: init.method ?? 'GET', body })
      // A line-batch create posts { records: [...] } and Airtable returns one
      // created record per posted record, in order. A header create/patch
      // posts { fields: {...} } and returns a single record id.
      if (body && Array.isArray((body as { records?: unknown[] }).records)) {
        const records = (body as { records: unknown[] }).records
        return {
          ok: true,
          status: 200,
          json: async () => ({
            records: records.map((_, i) => ({ id: `recLine${calls.length}-${i}` })),
          }),
          text: async () => '{}',
        }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'recNewStatement' }),
        text: async () => '{}',
      }
    }),
  )
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createStatement', () => {
  it('returns the new statement record id and the created line ids', async () => {
    const result = await createStatement({ rates, totals, meta })
    expect(result.statementId).toBe('recNewStatement')
    expect(result.lineIds).toHaveLength(totals.lines.length)
  })

  it('writes the header with linked contractor and correct totals', async () => {
    await createStatement({ rates, totals, meta })
    const header = calls[0].body as { fields: Record<string, unknown> }

    expect(header.fields.Contractor).toEqual(['rec36VBHdVAy4XyuY'])
    expect(header.fields['Contractor ID']).toBe('rec36VBHdVAy4XyuY')
    expect(header.fields.Type).toBe('Fortnightly')
    expect(header.fields['Period Start']).toBe('2026-07-21')
    expect(header.fields['Period End']).toBe('2026-08-03')
    expect(header.fields.Subtotal).toBe(425)
    expect(header.fields.GST).toBe(42.5)
    expect(header.fields.Reimbursements).toBe(45)
    expect(header.fields.Total).toBe(512.5)
    expect(header.fields['GST Registered At Submission']).toBe('YES')
  })

  it('writes the reference and the meta-supplied submitted-at instant, not a fresh timestamp', async () => {
    await createStatement({ rates, totals, meta })
    const header = calls[0].body as { fields: Record<string, unknown> }
    expect(header.fields.Reference).toBe('WFR-ATCVEXGZ')
    expect(header.fields['Submitted At']).toBe('2026-08-04T09:00:00.000Z')
  })

  it("writes the contractor's own invoice number alongside the internal reference", async () => {
    await createStatement({ rates, totals, meta })
    const header = calls[0].body as { fields: Record<string, unknown> }
    expect(header.fields['Contractor Invoice Number']).toBe('INV-001')
    expect(header.fields.Reference).toBe('WFR-ATCVEXGZ')
  })

  it('does not set Status on the initial header create, and marks it Submitted only after all lines are written', async () => {
    await createStatement({ rates, totals, meta })

    const headerCreate = calls[0].body as { fields: Record<string, unknown> }
    expect(headerCreate.fields.Status).toBeUndefined()

    // The header create, then one line batch, then a trailing PATCH.
    const last = calls[calls.length - 1]
    expect(last.method).toBe('PATCH')
    expect(last.url).toContain(`/${STATEMENTS_TABLE}/recNewStatement`)
    const patchBody = last.body as { fields: Record<string, unknown> }
    expect(patchBody.fields.Status).toBe('Submitted')
  })

  it('does not mark the statement Submitted if a line batch write fails', async () => {
    let call = 0
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
        call += 1
        calls.push({
          url,
          method: init.method ?? 'GET',
          body: init.body ? JSON.parse(init.body as string) : null,
        })
        // First call (header create) succeeds; the line batch that follows fails.
        if (call === 2) {
          return { ok: false, status: 503, json: async () => ({}), text: async () => 'boom' }
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 'recNewStatement', records: [{ id: 'recLine1' }] }),
          text: async () => '{}',
        }
      }),
    )

    await expect(createStatement({ rates, totals, meta })).rejects.toThrow('503')

    const patchCalls = calls.filter((c) => c.method === 'PATCH')
    expect(patchCalls).toHaveLength(0)
  })

  it('populates the primary Statement field with a human-readable label', async () => {
    await createStatement({ rates, totals, meta })
    const header = calls[0].body as { fields: Record<string, unknown> }
    expect(header.fields.Statement).toBe('HARLEY GATT — Fortnightly — 2026-07-21')
  })

  it('snapshots the rate card as JSON so later rate changes cannot alter it', async () => {
    await createStatement({ rates, totals, meta })
    const header = calls[0].body as { fields: Record<string, string> }
    expect(JSON.parse(header.fields['Rate Snapshot'])).toMatchObject({ baseShift: 425 })
  })

  it('omits identity fields (ABN, address, bank details) from the rate snapshot', async () => {
    // The snapshot exists to freeze pricing so a later rate change can't
    // retroactively alter a statement that already backed a claim. Identity
    // fields play no part in that — and Airtable already holds them in
    // INVOICE MATRIX — so serialising a contractor's bank account and BSB
    // into a long-text field on every Statements row is pure exposure with
    // no purpose.
    const ratesWithIdentity: RateCard = {
      ...rates,
      abn: '11 222 333 444',
      address: '1 Example St, Perth WA',
      bankAccount: '12345678',
      bankBsb: '086-000',
    }
    await createStatement({ rates: ratesWithIdentity, totals, meta })
    const header = calls[0].body as { fields: Record<string, string> }
    const snapshot = JSON.parse(header.fields['Rate Snapshot'])
    expect(snapshot).not.toHaveProperty('abn')
    expect(snapshot).not.toHaveProperty('address')
    expect(snapshot).not.toHaveProperty('bankAccount')
    expect(snapshot).not.toHaveProperty('bankBsb')
    // Pricing fields must still be there.
    expect(snapshot).toMatchObject({ baseShift: 425 })
  })

  it('writes one Statement Line per calculated line, linked to the header', async () => {
    await createStatement({ rates, totals, meta })
    const lines = calls[1].body as { records: Array<{ fields: Record<string, unknown> }> }

    expect(lines.records).toHaveLength(2)
    expect(lines.records[0].fields).toMatchObject({
      Statement: ['recNewStatement'],
      Date: '2026-07-21',
      'Line Type': 'Sub Contractor Labour Hire',
      Quantity: 1,
      'Unit Rate': 425,
      Amount: 425,
    })
    expect(lines.records[1].fields).toMatchObject({
      'Line Type': 'Reimbursement',
      Description: 'Car wash',
    })
  })

  it('populates the primary Line field on each line, including dated and dateless lines', async () => {
    await createStatement({ rates, totals, meta })
    const lines = calls[1].body as { records: Array<{ fields: Record<string, unknown> }> }

    expect(lines.records[0].fields.Line).toBe('2026-07-21 Sub Contractor Labour Hire')
    expect(lines.records[1].fields.Line).toBe('2026-07-22 Reimbursement')
  })

  it('records when the declaration was accepted, so the acceptance can be evidenced', async () => {
    await createStatement({ rates, totals, meta })
    const header = calls[0].body as { fields: Record<string, unknown> }
    expect(header.fields['Declaration Accepted At']).toBe(meta.declarationAcceptedAt)
  })

  it('records NO for an unregistered contractor', async () => {
    await createStatement({
      rates: { ...rates, gstRegistered: false },
      totals: rollUpTotals(totals.lines, false),
      meta,
    })
    const header = calls[0].body as { fields: Record<string, unknown> }
    expect(header.fields['GST Registered At Submission']).toBe('NO')
    expect(header.fields.GST).toBe(0)
  })

  it('omits the date on monthly bonus lines and uses the line type alone as the primary label', async () => {
    const bonusTotals = rollUpTotals(
      [
        {
          date: null,
          lineType: 'Google Review Bonus',
          quantity: 4,
          unitRate: 15,
          amount: 60,
          description: '',
          gstBearing: true,
        },
      ],
      true,
    )
    await createStatement({
      rates,
      totals: bonusTotals,
      meta: {
        type: 'monthly',
        periodStart: '2026-07-01',
        periodEnd: '2026-07-31',
        reference: 'WFR-ATCVEXGZ',
        submittedAt: '2026-08-04T09:00:00.000Z',
        contractorInvoiceNumber: 'INV-001',
        declarationAcceptedAt: '2026-08-04T09:00:00.000Z',
      },
    })
    const header = calls[0].body as { fields: Record<string, unknown> }
    expect(header.fields.Type).toBe('Monthly Bonus')
    expect(header.fields.Statement).toBe('HARLEY GATT — Monthly Bonus — 2026-07-01')

    const lines = calls[1].body as { records: Array<{ fields: Record<string, unknown> }> }
    expect(lines.records[0].fields.Date).toBeUndefined()
    expect(lines.records[0].fields.Line).toBe('Google Review Bonus')
  })

  it('writes a monthly note to the Notes field', async () => {
    await createStatement({ rates, totals: { ...totals, note: 'Tullamarine tow' }, meta })
    const header = calls[0].body as { fields: Record<string, unknown> }
    expect(header.fields.Notes).toBe('Tullamarine tow')
  })

  it('omits the Notes field entirely when there is no note', async () => {
    await createStatement({ rates, totals: { ...totals, note: null }, meta })
    const header = calls[0].body as { fields: Record<string, unknown> }
    expect(header.fields).not.toHaveProperty('Notes')
  })

  it('chunks line writes into batches of 10 or fewer records', async () => {
    const manyLines: StatementLine[] = Array.from({ length: 24 }, (_, i) => ({
      date: `2026-07-${String((i % 28) + 1).padStart(2, '0')}`,
      lineType: 'Sub Contractor Labour Hire',
      quantity: 1,
      unitRate: 425,
      amount: 425,
      description: '',
      gstBearing: true,
    }))
    const bigTotals = rollUpTotals(manyLines, true)

    const result = await createStatement({ rates, totals: bigTotals, meta })

    // calls[0] is the header POST, the trailing call is the Status PATCH;
    // everything between is a line-batch POST.
    const lineCalls = calls.slice(1, -1)
    expect(lineCalls.length).toBe(3)
    for (const call of lineCalls) {
      expect(call.method).toBe('POST')
      const body = call.body as { records: unknown[] }
      expect(body.records.length).toBeLessThanOrEqual(10)
    }
    const totalRecordsWritten = lineCalls.reduce(
      (sum, call) => sum + (call.body as { records: unknown[] }).records.length,
      0,
    )
    expect(totalRecordsWritten).toBe(24)
    expect(calls[calls.length - 1].method).toBe('PATCH')

    // Airtable returns created records in request order within each batch,
    // so concatenating each batch's ids in order must align 1:1 with
    // bigTotals.lines — including across the 10/10/4 batch boundary.
    expect(result.lineIds).toHaveLength(24)
    expect(new Set(result.lineIds).size).toBe(24)
    expect(result.lineIds[0]).toBe('recLine2-0') // first id returned by the first line batch (calls[1])
    expect(result.lineIds[9]).toBe('recLine2-9') // last id of the first batch
    expect(result.lineIds[10]).toBe('recLine3-0') // first id of the second batch, across the boundary
    expect(result.lineIds[23]).toBe('recLine4-3') // last id of the third (partial) batch
  })
})

describe('attachPdfToStatement', () => {
  it('posts the PDF to the content.airtable.com upload endpoint addressed by field name', async () => {
    await attachPdfToStatement('recSTMTSTMTSTMTST', 'statement.pdf', Buffer.from('fake-pdf'))
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(
      'https://content.airtable.com/v0/appNMPu4UACVHBBbR/recSTMTSTMTSTMTST/PDF/uploadAttachment',
    )
    const body = calls[0].body as { contentType: string; filename: string; file: string }
    expect(body.contentType).toBe('application/pdf')
    expect(body.filename).toBe('statement.pdf')
    expect(body.file).toBe(Buffer.from('fake-pdf').toString('base64'))
  })

  it('surfaces the HTTP status when the upload fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({}),
        text: async () => 'Invalid attachment field',
      }),
    )
    await expect(
      attachPdfToStatement('recSTMTSTMTSTMTST', 'statement.pdf', Buffer.from('fake-pdf')),
    ).rejects.toThrow('422')
  })
})

describe('attachReceiptToLine', () => {
  it('posts the receipt to the content.airtable.com upload endpoint for the Receipt field', async () => {
    await attachReceiptToLine('recLINELINELINELI', 'receipt.jpg', 'image/jpeg', 'ZmFrZS1qcGVn')
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(
      'https://content.airtable.com/v0/appNMPu4UACVHBBbR/recLINELINELINELI/Receipt/uploadAttachment',
    )
    const body = calls[0].body as { contentType: string; filename: string; file: string }
    expect(body.contentType).toBe('image/jpeg')
    expect(body.filename).toBe('receipt.jpg')
    expect(body.file).toBe('ZmFrZS1qcGVn')
  })

  it('surfaces the HTTP status when the upload fails, without leaking the token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({}),
        text: async () => 'Invalid attachment field',
      }),
    )
    await expect(
      attachReceiptToLine('recLINELINELINELI', 'receipt.jpg', 'image/jpeg', 'ZmFrZS1qcGVn'),
    ).rejects.toThrow('422')

    try {
      await attachReceiptToLine('recLINELINELINELI', 'receipt.jpg', 'image/jpeg', 'ZmFrZS1qcGVn')
      expect.unreachable('expected attachReceiptToLine to throw')
    } catch (error) {
      expect(String(error)).not.toContain('pat_test')
    }
  })
})

describe('recordStatementWarning', () => {
  it('PATCHes the Warnings field on the statement', async () => {
    await recordStatementWarning('recSTMTSTMTSTMTST', 'PDF failed to attach: boom')
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('PATCH')
    expect(calls[0].url).toContain(`/${STATEMENTS_TABLE}/recSTMTSTMTSTMTST`)
    const body = calls[0].body as { fields: Record<string, unknown> }
    expect(body.fields.Warnings).toBe('PDF failed to attach: boom')
  })

  it('swallows its own failure rather than throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
        text: async () => 'boom',
      }),
    )
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(
      recordStatementWarning('recSTMTSTMTSTMTST', 'PDF failed to attach: boom'),
    ).resolves.toBeUndefined()
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })
})

describe('listStatementsForContractor', () => {
  it('returns submitted statements for the contractor, most recent first', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        calls.push({ url, method: 'GET', body: null })
        return {
          ok: true,
          status: 200,
          json: async () => ({
            records: [
              {
                id: 'recOld',
                fields: {
                  Type: 'Fortnightly',
                  'Period Start': '2026-06-01',
                  'Period End': '2026-06-14',
                  Total: 500,
                  'Submitted At': '2026-06-15T00:00:00.000Z',
                  Reference: 'WFR-OLDOLDOL',
                  // Attach failed for this one — the PDF field is simply absent.
                },
              },
              {
                id: 'recNew',
                fields: {
                  Type: 'Fortnightly',
                  'Period Start': '2026-07-21',
                  'Period End': '2026-08-03',
                  Total: 512.5,
                  'Submitted At': '2026-08-04T00:00:00.000Z',
                  Reference: 'WFR-ATCVEXGZ',
                  PDF: [{ url: 'https://airtable.example/pdf/recNew.pdf', filename: 'statement.pdf' }],
                },
              },
            ],
          }),
          text: async () => '{}',
        }
      }),
    )

    const result = await listStatementsForContractor('rec36VBHdVAy4XyuY')
    expect(result.map((r) => r.id)).toEqual(['recNew', 'recOld'])
    expect(result[0]).toMatchObject({
      type: 'Fortnightly',
      periodStart: '2026-07-21',
      periodEnd: '2026-08-03',
      total: 512.5,
      reference: 'WFR-ATCVEXGZ',
      pdfUrl: 'https://airtable.example/pdf/recNew.pdf',
    })
  })

  it('returns a null pdfUrl, rather than a broken link, when the PDF attachment is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          records: [
            {
              id: 'recNoAttach',
              fields: {
                Type: 'Fortnightly',
                'Period Start': '2026-06-01',
                'Period End': '2026-06-14',
                Total: 500,
                'Submitted At': '2026-06-15T00:00:00.000Z',
                Reference: 'WFR-NOATTACH',
              },
            },
          ],
        }),
        text: async () => '{}',
      }),
    )

    const result = await listStatementsForContractor('rec36VBHdVAy4XyuY')
    expect(result[0].pdfUrl).toBeNull()
  })

  it('filters by an exact match on Contractor ID rather than the Contractor link', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
        calls.push({ url, method: init.method ?? 'GET', body: null })
        return { ok: true, status: 200, json: async () => ({ records: [] }), text: async () => '{}' }
      }),
    )

    await listStatementsForContractor('rec36VBHdVAy4XyuY')

    expect(calls).toHaveLength(1)
    const decodedUrl = decodeURIComponent(calls[0].url)
    expect(decodedUrl).toContain('{Contractor ID}="rec36VBHdVAy4XyuY"')
    expect(decodedUrl).toContain('{Status}="Submitted"')
    // A link field resolves to its linked record's primary field text (the
    // contractor's Name), not its record ID, so an ARRAYJOIN/FIND match
    // against {Contractor} would never find the right rows.
    expect(decodedUrl).not.toContain('ARRAYJOIN')
  })

  it('rejects a malformed contractor id before building a formula', async () => {
    await expect(listStatementsForContractor('drop table')).rejects.toThrow(
      /invalid airtable record id/i,
    )
  })
})

describe('statementTypeLabel', () => {
  it('maps fortnightly to the Fortnightly display type', () => {
    expect(statementTypeLabel('fortnightly')).toBe('Fortnightly')
  })

  it('maps monthly to the Monthly Bonus display type', () => {
    expect(statementTypeLabel('monthly')).toBe('Monthly Bonus')
  })
})

describe('findSubmittedStatement', () => {
  it('returns the matching record when a Submitted statement exists for the same contractor, type and period', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
        calls.push({ url, method: init.method ?? 'GET', body: null })
        return {
          ok: true,
          status: 200,
          json: async () => ({ records: [{ id: 'recSTMTSTMTSTMTST' }] }),
          text: async () => '{}',
        }
      }),
    )

    const result = await findSubmittedStatement(
      'rec36VBHdVAy4XyuY',
      'Fortnightly',
      '2026-07-21',
    )
    expect(result).toEqual({ id: 'recSTMTSTMTSTMTST' })
  })

  it('returns null when no matching Submitted statement exists', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ records: [] }),
        text: async () => '{}',
      }),
    )

    const result = await findSubmittedStatement(
      'rec36VBHdVAy4XyuY',
      'Fortnightly',
      '2026-07-21',
    )
    expect(result).toBeNull()
  })

  it('filters on contractor, type, period start and Submitted status together', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
        calls.push({ url, method: init.method ?? 'GET', body: null })
        return { ok: true, status: 200, json: async () => ({ records: [] }), text: async () => '{}' }
      }),
    )

    await findSubmittedStatement('rec36VBHdVAy4XyuY', 'Fortnightly', '2026-07-21')

    const decodedUrl = decodeURIComponent(calls[0].url)
    expect(decodedUrl).toContain('{Contractor ID}="rec36VBHdVAy4XyuY"')
    expect(decodedUrl).toContain('{Type}="Fortnightly"')
    // Period Start is an Airtable Date field, not text — comparing it to a
    // bare string literal is unreliable. DATESTR() coerces both sides to an
    // unambiguous ISO date string. Do not simplify this back to a bare
    // {Period Start}="..." comparison.
    expect(decodedUrl).toContain('DATESTR({Period Start})="2026-07-21"')
    expect(decodedUrl).toContain('{Status}="Submitted"')
  })

  it('rejects a malformed contractor id before building a formula', async () => {
    await expect(
      findSubmittedStatement('not-a-record-id', 'Fortnightly', '2026-07-21'),
    ).rejects.toThrow(/invalid airtable record id/i)
  })
})
