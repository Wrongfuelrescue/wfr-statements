import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getStatement,
  listLinesForStatements,
  listRoster,
  listStatementsInRange,
} from '../management'

let urls: string[]

/** Queues one response per fetch call, in order. */
function serve(...payloads: unknown[]) {
  let index = 0
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (url: string) => {
      urls.push(decodeURIComponent(url))
      const body = payloads[Math.min(index++, payloads.length - 1)]
      return {
        ok: true,
        status: 200,
        json: async () => body,
        text: async () => JSON.stringify(body),
      }
    }),
  )
}

beforeEach(() => {
  process.env.AIRTABLE_TOKEN = 'pat_test'
  process.env.AIRTABLE_BASE_ID = 'appNMPu4UACVHBBbR'
  urls = []
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const fullRecord = {
  id: 'recSTATEMENT00001',
  fields: {
    Reference: 'INV-MYFAAMJP',
    'Contractor ID': 'recCONTRACTOR0001',
    Contractor: ['recCONTRACTOR0001'],
    Statement: 'PATRICK HUTCHINSON — Fortnightly — 2026-07-20',
    Type: 'Fortnightly',
    'Period Start': '2026-07-20',
    'Period End': '2026-08-02',
    Subtotal: 927.26,
    GST: 92.73,
    Reimbursements: 50,
    Total: 1069.99,
    'GST Registered At Submission': 'YES',
    Status: 'Submitted',
    'Submitted At': '2026-08-05T12:47:02.972Z',
    PDF: [{ url: 'https://example.test/a.pdf' }],
  },
}

describe('listStatementsInRange', () => {
  /**
   * Period End is an Airtable Date field. Comparing a Date field to a string
   * literal is not reliable formula semantics — the same class of bug that
   * already required DATESTR() in findSubmittedStatement.
   */
  it('filters on Period End with date functions, never string comparison', async () => {
    serve({ records: [] })
    await listStatementsInRange('2026-07-01', '2026-09-30')

    expect(urls[0]).toContain('DATETIME_PARSE')
    expect(urls[0]).not.toContain('{Period End}="')
  })

  /**
   * Airtable's formula language has IS_AFTER, IS_BEFORE and IS_SAME — and
   * nothing else for comparing dates. A formula using a plausible-sounding
   * function that does not exist is rejected with a 422 at request time, not
   * at build time, so the whole page 500s in production. That happened: an
   * invented IS_ON_OR_AFTER/IS_ON_OR_BEFORE shipped because the test asserted
   * only that the URL contained those names — it verified the invention
   * rather than the API. Pin the real function names instead.
   */
  it('uses only real Airtable date functions', async () => {
    serve({ records: [] })
    await listStatementsInRange('2026-07-01', '2026-09-30')

    const REAL = ['AND', 'OR', 'NOT', 'IS_AFTER', 'IS_BEFORE', 'IS_SAME', 'DATETIME_PARSE']
    const called = [...urls[0].matchAll(/\b([A-Z][A-Z_]+)\s*\(/g)].map((match) => match[1])

    expect(called.length).toBeGreaterThan(0)
    expect(called.filter((fn) => !REAL.includes(fn))).toEqual([])
  })

  /** Both ends are inclusive: a statement ending exactly on a boundary counts. */
  it('includes both range boundaries', async () => {
    serve({ records: [] })
    await listStatementsInRange('2026-07-01', '2026-09-30')

    expect(urls[0]).toContain('IS_SAME')
  })

  it('maps a complete record', async () => {
    serve({ records: [fullRecord] })

    const [statement] = await listStatementsInRange('2026-07-01', '2026-09-30')
    expect(statement.contractorName).toBe('PATRICK HUTCHINSON')
    expect(statement.label).toBe('PATRICK HUTCHINSON — Fortnightly — 2026-07-20')
    expect(statement.contractorId).toBe('recCONTRACTOR0001')
    expect(statement.gstRegisteredAtSubmission).toBe(true)
    expect(statement.total).toBe(1069.99)
    expect(statement.pdfUrl).toBe('https://example.test/a.pdf')
    expect(statement.warnings).toBe('')
    expect(statement.supersedesId).toBeNull()
  })

  it('reads a single-select Status returned as an object', async () => {
    serve({
      records: [
        {
          id: 'recA00000000000001',
          fields: { 'Period End': '2026-08-02', Status: { id: 'sel1', name: 'Submitted' } },
        },
      ],
    })
    expect((await listStatementsInRange('2026-07-01', '2026-09-30'))[0].status).toBe('Submitted')
  })

  /** Both are the Exceptions view's entire subject. */
  it('includes rows with a blank Status and rows that are Superseded', async () => {
    serve({
      records: [
        { id: 'recA00000000000001', fields: { 'Period End': '2026-08-02' } },
        { id: 'recB00000000000002', fields: { 'Period End': '2026-08-02', Status: 'Superseded' } },
      ],
    })

    const statements = await listStatementsInRange('2026-07-01', '2026-09-30')
    expect(statements.map((s) => s.status).sort()).toEqual(['', 'Superseded'])
  })

  it('renders a missing PDF attachment as null, not a broken url', async () => {
    serve({ records: [{ id: 'recC00000000000003', fields: { 'Period End': '2026-08-02', PDF: [] } }] })
    expect((await listStatementsInRange('2026-07-01', '2026-09-30'))[0].pdfUrl).toBeNull()
  })

  it('reads the Supersedes link as a record id', async () => {
    serve({
      records: [
        {
          id: 'recC00000000000003',
          fields: { 'Period End': '2026-08-02', Supersedes: ['recOLDSTATEMENT1'] },
        },
      ],
    })
    expect((await listStatementsInRange('2026-07-01', '2026-09-30'))[0].supersedesId).toBe(
      'recOLDSTATEMENT1',
    )
  })

  it('follows pagination', async () => {
    serve(
      { records: [{ id: 'recD00000000000004', fields: {} }], offset: 'off1' },
      { records: [{ id: 'recE00000000000005', fields: {} }] },
    )

    expect(await listStatementsInRange('2026-07-01', '2026-09-30')).toHaveLength(2)
    expect(urls[1]).toContain('offset=off1')
  })
})

describe('getStatement', () => {
  it('maps a single record the same way as the list', async () => {
    serve(fullRecord)
    const statement = await getStatement('recSTATEMENT00001')
    expect(statement?.reference).toBe('INV-MYFAAMJP')
    expect(statement?.total).toBe(1069.99)
  })

  /** The id comes from a URL path segment, so it must never reach a URL unchecked. */
  it('returns null for a malformed record id without calling Airtable', async () => {
    serve({ records: [] })
    expect(await getStatement('../../not-a-record')).toBeNull()
    expect(urls).toHaveLength(0)
  })

  it('returns null when the record does not exist', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({}),
        text: async () => 'NOT_FOUND',
      }),
    )
    expect(await getStatement('recMISSING0000001')).toBeNull()
  })
})

describe('listLinesForStatements', () => {
  const parent = {
    id: 'recSTATEMENT00001',
    label: 'PATRICK HUTCHINSON — Fortnightly — 2026-07-20',
  }

  it('returns nothing without calling Airtable when given no statements', async () => {
    serve({ records: [] })
    expect(await listLinesForStatements([])).toEqual([])
    expect(urls).toHaveLength(0)
  })

  /**
   * In a formula the link field resolves to the parent's PRIMARY FIELD TEXT,
   * not its record id — the trap documented in "Why Contractor ID exists".
   */
  it('filters on the parent label, never on a record id', async () => {
    serve({ records: [] })
    await listLinesForStatements([parent])

    expect(urls[0]).toContain('PATRICK HUTCHINSON — Fortnightly — 2026-07-20')
    expect(urls[0]).not.toContain('recSTATEMENT00001')
  })

  /** Read back over the API, the same link field IS an array of record ids. */
  it('resolves each line to its parent from the link field', async () => {
    serve({
      records: [
        {
          id: 'recLINE0000000001',
          fields: {
            Statement: ['recSTATEMENT00001'],
            Date: '2026-07-20',
            'Line Type': 'Base Shift',
            Quantity: 1,
            'Unit Rate': 320,
            Amount: 320,
          },
        },
      ],
    })

    const [line] = await listLinesForStatements([parent])
    expect(line.statementId).toBe('recSTATEMENT00001')
    expect(line.date).toBe('2026-07-20')
    expect(line.lineType).toBe('Base Shift')
    expect(line.amount).toBe(320)
  })

  /**
   * Defensive: a link field that ever arrives as `[{id, name}]` rather than
   * `["rec…"]` must still resolve. If it did not, every line would fail the
   * parent check below and the cost breakdown would silently read as empty
   * rather than erroring.
   */
  it('resolves a link field given as objects rather than bare ids', async () => {
    serve({
      records: [
        {
          id: 'recLINE0000000003',
          fields: {
            Statement: [{ id: 'recSTATEMENT00001', name: 'PATRICK HUTCHINSON — Fortnightly' }],
            Amount: 320,
          },
        },
      ],
    })
    const lines = await listLinesForStatements([parent])
    expect(lines).toHaveLength(1)
    expect(lines[0].statementId).toBe('recSTATEMENT00001')
  })

  /**
   * A superseded statement and its replacement share a label, so the label
   * filter can return lines belonging to a statement we did not ask for.
   */
  it('drops lines whose parent is not in the requested set', async () => {
    serve({
      records: [
        { id: 'recLINE0000000001', fields: { Statement: ['recSTATEMENT00001'], Amount: 320 } },
        { id: 'recLINE0000000002', fields: { Statement: ['recOTHERSTATEMEN'], Amount: 999 } },
      ],
    })

    const lines = await listLinesForStatements([parent])
    expect(lines).toHaveLength(1)
    expect(lines[0].statementId).toBe('recSTATEMENT00001')
  })

  it('escapes a double quote in a label rather than breaking the formula', async () => {
    serve({ records: [] })
    await listLinesForStatements([{ id: 'recSTATEMENT00009', label: 'A "QUOTED" NAME' }])
    expect(urls[0]).toContain('A \\"QUOTED\\" NAME')
  })

  it('reads a dateless bonus line as a null date', async () => {
    serve({
      records: [
        {
          id: 'recLINE0000000002',
          fields: {
            Statement: ['recSTATEMENT00002'],
            'Line Type': 'Google Review Bonus',
            Quantity: 5,
            'Unit Rate': 20,
            Amount: 100,
          },
        },
      ],
    })
    const lines = await listLinesForStatements([
      { id: 'recSTATEMENT00002', label: 'A NAME — Monthly Bonus — 2026-08-01' },
    ])
    expect(lines[0].date).toBeNull()
  })

  it('chunks large statement lists into several requests', async () => {
    serve({ records: [] })
    const many = Array.from({ length: 55 }, (_, i) => ({
      id: `recID${String(i).padStart(12, '0')}`,
      label: `NAME ${i} — Fortnightly — 2026-07-20`,
    }))
    await listLinesForStatements(many)
    expect(urls.length).toBeGreaterThan(1)
  })
})

describe('listRoster', () => {
  it('exposes whether a PIN is set but never the PIN itself', async () => {
    serve({
      records: [
        {
          id: 'recCONTRACTOR0001',
          fields: {
            fldmcoKmZ64smsy4d: 'PATRICK HUTCHINSON',
            fldBxnlmA8rBPM1NS: 'MEL',
            fldooFZGxLjvrLxkG: 'MEL VAN 2',
            fldPJYhQLpDjXt6j4: '',
            fldyP4CHwcp6r05zE: 'YES',
            fld6CFxmZTBfqaymw: '123456',
          },
        },
      ],
    })

    const [entry] = await listRoster()
    expect(entry).toEqual({
      id: 'recCONTRACTOR0001',
      name: 'PATRICK HUTCHINSON',
      city: 'MEL',
      van: 'MEL VAN 2',
      abn: '',
      gstRegistered: true,
      hasPin: true,
    })
    expect(JSON.stringify(entry)).not.toContain('123456')
  })

  it('reports a blank PIN as hasPin false', async () => {
    serve({
      records: [
        { id: 'recCONTRACTOR0002', fields: { fldmcoKmZ64smsy4d: 'A NAME', fld6CFxmZTBfqaymw: '' } },
      ],
    })
    expect((await listRoster())[0].hasPin).toBe(false)
  })

  it('reports a missing PIN field as hasPin false', async () => {
    serve({ records: [{ id: 'recCONTRACTOR0004', fields: { fldmcoKmZ64smsy4d: 'A NAME' } }] })
    expect((await listRoster())[0].hasPin).toBe(false)
  })

  it('drops rows with no name', async () => {
    serve({ records: [{ id: 'recCONTRACTOR0003', fields: { fld6CFxmZTBfqaymw: '123456' } }] })
    expect(await listRoster()).toEqual([])
  })

  it('sorts by name', async () => {
    serve({
      records: [
        { id: 'recCONTRACTOR0001', fields: { fldmcoKmZ64smsy4d: 'SIMON CAMERON' } },
        { id: 'recCONTRACTOR0002', fields: { fldmcoKmZ64smsy4d: 'GORDEN LOCKHART' } },
      ],
    })
    expect((await listRoster()).map((e) => e.name)).toEqual(['GORDEN LOCKHART', 'SIMON CAMERON'])
  })
})
