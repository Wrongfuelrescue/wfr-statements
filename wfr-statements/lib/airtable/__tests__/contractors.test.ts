import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  listContractors,
  getContractorRaw,
  getRateCard,
  getLoginState,
  setLoginThrottle,
} from '../contractors'
import { FIELDS } from '../fields'

function selectCell(name: string) {
  return { id: 'selXXXXXXXXXXXXXX', name, color: 'blueBright' }
}

const harleyFields = {
  [FIELDS.technician]: selectCell('HARLEY GATT'),
  [FIELDS.van]: selectCell('MEL VAN 2'),
  [FIELDS.city]: selectCell('MEL'),
  [FIELDS.shift]: selectCell('Week on / Week off'),
  [FIELDS.gstRegistered]: selectCell('YES'),
  [FIELDS.baseShift]: selectCell('425'),
  [FIELDS.additionalLabour]: selectCell('77.27'),
  [FIELDS.rosteredDayOff]: selectCell('525'),
  [FIELDS.minorService]: selectCell('N/A'),
  [FIELDS.majorService]: selectCell('N/A'),
  [FIELDS.googleReviewBonus]: selectCell('15'),
  [FIELDS.fuelFilter30]: selectCell('30'),
  [FIELDS.fuelFilter70]: selectCell('70'),
  [FIELDS.abn]: '12 345 678 901',
  [FIELDS.address]: '12 Example St, Melbourne VIC 3000',
  [FIELDS.bankAccount]: '12345678',
  [FIELDS.bankBsb]: '123-456',
}

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  })
}

beforeEach(() => {
  process.env.AIRTABLE_TOKEN = 'pat_test'
  process.env.AIRTABLE_BASE_ID = 'appNMPu4UACVHBBbR'
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('listContractors', () => {
  it('returns id and name for each record, sorted by name', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchOnce({
        records: [
          { id: 'recB', fields: { [FIELDS.technician]: selectCell('ZIKO GEORGIOU') } },
          { id: 'recA', fields: { [FIELDS.technician]: selectCell('ADEM DINCER') } },
        ],
      }),
    )

    const result = await listContractors()
    expect(result).toEqual([
      { id: 'recA', name: 'ADEM DINCER' },
      { id: 'recB', name: 'ZIKO GEORGIOU' },
    ])
  })

  it('skips records with no technician name', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchOnce({
        records: [
          { id: 'recA', fields: { [FIELDS.technician]: selectCell('ADEM DINCER') } },
          { id: 'recB', fields: {} },
        ],
      }),
    )
    expect(await listContractors()).toHaveLength(1)
  })

  it('sends the bearer token and never exposes it in the path', async () => {
    const spy = mockFetchOnce({ records: [] })
    vi.stubGlobal('fetch', spy)

    await listContractors()

    const [url, init] = spy.mock.calls[0]
    expect(url).toContain('appNMPu4UACVHBBbR')
    expect(url).not.toContain('pat_test')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer pat_test')
  })

  it('throws a readable error when Airtable rejects the request', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({ error: 'NOT_FOUND' }, false, 404))
    await expect(listContractors()).rejects.toThrow(/Airtable request failed \(404\)/)
  })
})

describe('getContractorRaw', () => {
  it('flattens singleSelect cells to their string names', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({ id: 'rec36VBHdVAy4XyuY', fields: harleyFields }))

    const raw = await getContractorRaw('rec36VBHdVAy4XyuY')
    expect(raw.id).toBe('rec36VBHdVAy4XyuY')
    expect(raw.technician).toBe('HARLEY GATT')
    expect(raw.baseShift).toBe('425')
    expect(raw.minorService).toBe('N/A')
  })

  it('returns an empty string for a missing cell', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({ id: 'recTESTTESTTESTTE', fields: {} }))
    const raw = await getContractorRaw('recTESTTESTTESTTE')
    expect(raw.gstRegistered).toBe('')
  })

  it('reads the contractor identity fields', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchOnce({
        id: 'rec36VBHdVAy4XyuY',
        fields: {
          ...harleyFields,
          [FIELDS.abn]: '12 345 678 901',
          [FIELDS.address]: '12 Example St, Melbourne VIC 3000',
          [FIELDS.bankAccount]: '12345678',
          [FIELDS.bankBsb]: '123-456',
        },
      }),
    )

    const raw = await getContractorRaw('rec36VBHdVAy4XyuY')
    expect(raw.abn).toBe('12 345 678 901')
    expect(raw.address).toBe('12 Example St, Melbourne VIC 3000')
    expect(raw.bankAccount).toBe('12345678')
    expect(raw.bankBsb).toBe('123-456')
  })

  it('returns empty strings when the identity fields are unset', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({ id: 'recTESTTESTTESTTE', fields: {} }))
    const raw = await getContractorRaw('recTESTTESTTESTTE')
    expect(raw.abn).toBe('')
    expect(raw.address).toBe('')
    expect(raw.bankAccount).toBe('')
    expect(raw.bankBsb).toBe('')
  })
})

describe('getRateCard', () => {
  it('returns a parsed rate card', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({ id: 'rec36VBHdVAy4XyuY', fields: harleyFields }))

    const card = await getRateCard('rec36VBHdVAy4XyuY')
    expect(card.name).toBe('HARLEY GATT')
    expect(card.baseShift).toBe(425)
    expect(card.gstRegistered).toBe(true)
    expect(card.minorService).toBeNull()
  })
})

describe('getLoginState', () => {
  it('returns the PIN from the record', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({ id: 'recTESTTESTTESTTE', fields: { PIN: '123456' } }))
    expect((await getLoginState('recTESTTESTTESTTE')).pin).toBe('123456')
  })

  it('trims surrounding whitespace from the stored PIN', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({ id: 'recTESTTESTTESTTE', fields: { PIN: ' 123456 ' } }))
    expect((await getLoginState('recTESTTESTTESTTE')).pin).toBe('123456')
  })

  it('returns an empty string when no PIN is set, so the record cannot be logged into', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({ id: 'recTESTTESTTESTTE', fields: {} }))
    expect((await getLoginState('recTESTTESTTESTTE')).pin).toBe('')
  })

  it('requests fields by name, not by field id', async () => {
    // The PIN field is read by name. Adding returnFieldsByFieldId=true here
    // would key the response by field id instead, fields.PIN would be
    // undefined, and every contractor login would silently fail.
    const spy = mockFetchOnce({ id: 'recTESTTESTTESTTE', fields: { PIN: '123456' } })
    vi.stubGlobal('fetch', spy)

    await getLoginState('recTESTTESTTESTTE')

    const [url] = spy.mock.calls[0]
    expect(url).not.toContain('returnFieldsByFieldId')
    expect(url).toContain('recTESTTESTTESTTE')
  })

  it('surfaces a readable error when Airtable rejects the request', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({ error: 'NOT_FOUND' }, false, 404))
    await expect(getLoginState('recTESTTESTTESTTE')).rejects.toThrow(/Airtable request failed \(404\)/)
  })

  it('defaults failedAttempts to 0 when the field is absent', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({ id: 'recTESTTESTTESTTE', fields: { PIN: '123456' } }))
    expect((await getLoginState('recTESTTESTTESTTE')).failedAttempts).toBe(0)
  })

  it('returns lockedUntil as null when the field is absent', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({ id: 'recTESTTESTTESTTE', fields: { PIN: '123456' } }))
    expect((await getLoginState('recTESTTESTTESTTE')).lockedUntil).toBeNull()
  })

  it('returns lockedUntil as null when the field is unparseable', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchOnce({ id: 'recTESTTESTTESTTE', fields: { PIN: '123456', 'Locked Until': 'not-a-date' } }),
    )
    expect((await getLoginState('recTESTTESTTESTTE')).lockedUntil).toBeNull()
  })

  it('parses a stored lockedUntil ISO string to epoch milliseconds', async () => {
    const iso = '2026-01-01T00:00:00.000Z'
    vi.stubGlobal(
      'fetch',
      mockFetchOnce({ id: 'recTESTTESTTESTTE', fields: { PIN: '123456', 'Locked Until': iso } }),
    )
    expect((await getLoginState('recTESTTESTTESTTE')).lockedUntil).toBe(Date.parse(iso))
  })

  it('parses a stored failedAttempts count', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchOnce({ id: 'recTESTTESTTESTTE', fields: { PIN: '123456', 'Failed Attempts': 3 } }),
    )
    expect((await getLoginState('recTESTTESTTESTTE')).failedAttempts).toBe(3)
  })
})

describe('record id validation', () => {
  it('rejects a malformed record id before reaching getContractorRaw', async () => {
    await expect(getContractorRaw('rec"OR 1=1"')).rejects.toThrow(/invalid airtable record id/i)
  })

  it('rejects a malformed record id before reaching getLoginState', async () => {
    await expect(getLoginState('../../etc/passwd')).rejects.toThrow(/invalid airtable record id/i)
  })

  it('rejects a malformed record id before reaching setLoginThrottle', async () => {
    await expect(setLoginThrottle('not-a-record-id', 0, null)).rejects.toThrow(
      /invalid airtable record id/i,
    )
  })
})

describe('setLoginThrottle', () => {
  it('PATCHes the failed-attempts and locked-until fields by name', async () => {
    const spy = mockFetchOnce({ id: 'recTESTTESTTESTTE', fields: {} })
    vi.stubGlobal('fetch', spy)

    await setLoginThrottle('recTESTTESTTESTTE', 2, null)

    const [url, init] = spy.mock.calls[0]
    expect(url).toContain('recTESTTESTTESTTE')
    expect(init.method).toBe('PATCH')
    const body = JSON.parse(init.body as string)
    expect(body.fields['Failed Attempts']).toBe(2)
    expect(body.fields['Locked Until']).toBeNull()
  })
})
