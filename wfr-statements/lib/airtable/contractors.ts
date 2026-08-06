import 'server-only'
import { buildRateCard } from '@/lib/rates/rateCard'
import type { RateCard, RawContractorRecord } from '@/lib/rates/types'
import { airtableFetch } from './client'
import { FIELDS, INVOICE_MATRIX_TABLE, NEW_FIELDS } from './fields'
import { assertRecordId } from './recordId'

type AirtableCell = string | number | { name?: string } | null | undefined
type AirtableRecord = { id: string; fields: Record<string, AirtableCell> }

/** singleSelect cells arrive as `{ id, name, color }`; everything else as a scalar. */
function cellToString(cell: AirtableCell): string {
  if (cell === null || cell === undefined) return ''
  if (typeof cell === 'string') return cell
  if (typeof cell === 'number') return String(cell)
  return cell.name ?? ''
}

export async function listContractors(): Promise<Array<{ id: string; name: string }>> {
  const data = (await airtableFetch(
    `/${INVOICE_MATRIX_TABLE}?pageSize=100&returnFieldsByFieldId=true`,
  )) as { records: AirtableRecord[] }

  return data.records
    .map((r) => ({ id: r.id, name: cellToString(r.fields[FIELDS.technician]) }))
    .filter((c) => c.name !== '')
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function getContractorRaw(recordId: string): Promise<RawContractorRecord> {
  assertRecordId(recordId)
  const record = (await airtableFetch(
    `/${INVOICE_MATRIX_TABLE}/${recordId}?returnFieldsByFieldId=true`,
  )) as AirtableRecord

  const f = record.fields
  return {
    id: record.id,
    technician: cellToString(f[FIELDS.technician]),
    abn: cellToString(f[FIELDS.abn]),
    address: cellToString(f[FIELDS.address]),
    bankAccount: cellToString(f[FIELDS.bankAccount]),
    bankBsb: cellToString(f[FIELDS.bankBsb]),
    van: cellToString(f[FIELDS.van]),
    city: cellToString(f[FIELDS.city]),
    shiftPattern: cellToString(f[FIELDS.shift]),
    gstRegistered: cellToString(f[FIELDS.gstRegistered]),
    baseShift: cellToString(f[FIELDS.baseShift]),
    additionalLabour: cellToString(f[FIELDS.additionalLabour]),
    rosteredDayOff: cellToString(f[FIELDS.rosteredDayOff]),
    minorService: cellToString(f[FIELDS.minorService]),
    majorService: cellToString(f[FIELDS.majorService]),
    googleReviewBonus: cellToString(f[FIELDS.googleReviewBonus]),
    fuelFilter30: cellToString(f[FIELDS.fuelFilter30]),
    fuelFilter70: cellToString(f[FIELDS.fuelFilter70]),
  }
}

export async function getRateCard(recordId: string): Promise<RateCard> {
  return buildRateCard(await getContractorRaw(recordId))
}

export type LoginState = {
  /** Empty string when no PIN is set — such a record can never be logged into. */
  pin: string
  failedAttempts: number
  /** Epoch milliseconds, or null when not locked. */
  lockedUntil: number | null
}

/**
 * Reads PIN and throttle state in one request. Throttle state lives on the
 * Airtable record rather than in process memory because this deploys to
 * serverless instances that do not share memory — an in-process counter would
 * reset on every cold start and be bypassable by concurrent requests.
 */
export async function getLoginState(recordId: string): Promise<LoginState> {
  assertRecordId(recordId)
  const record = (await airtableFetch(
    `/${INVOICE_MATRIX_TABLE}/${recordId}`,
  )) as AirtableRecord

  const rawLockedUntil = cellToString(record.fields[NEW_FIELDS.lockedUntil]).trim()
  const parsedLock = rawLockedUntil === '' ? NaN : Date.parse(rawLockedUntil)

  return {
    pin: cellToString(record.fields[NEW_FIELDS.pin]).trim(),
    failedAttempts: Number(cellToString(record.fields[NEW_FIELDS.failedAttempts])) || 0,
    lockedUntil: Number.isNaN(parsedLock) ? null : parsedLock,
  }
}

/** Persists throttle state. `lockedUntil` is an ISO string, or null to clear. */
export async function setLoginThrottle(
  recordId: string,
  failedAttempts: number,
  lockedUntil: string | null,
): Promise<void> {
  assertRecordId(recordId)
  await airtableFetch(`/${INVOICE_MATRIX_TABLE}/${recordId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      fields: {
        [NEW_FIELDS.failedAttempts]: failedAttempts,
        [NEW_FIELDS.lockedUntil]: lockedUntil,
      },
      typecast: true,
    }),
  })
}
