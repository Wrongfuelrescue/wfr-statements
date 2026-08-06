import { parseRate, RateParseError } from './parse'
import { standardDayHours } from './shiftHours'
import type { RateCard, RawContractorRecord } from './types'

/** Rates every contractor must have. A null here is a data error, not an entitlement. */
function required(
  raw: string,
  fieldLabel: string,
): number {
  const value = parseRate(raw, fieldLabel)
  if (value === null) throw new RateParseError(fieldLabel, raw ?? '')
  return value
}

export function buildRateCard(raw: RawContractorRecord): RateCard {
  return {
    contractorId: raw.id,
    name: raw.technician,
    abn: raw.abn.trim(),
    address: raw.address.trim(),
    bankAccount: raw.bankAccount.trim(),
    bankBsb: raw.bankBsb.trim(),
    standardDayHours: standardDayHours(raw.shiftPattern),
    van: raw.van,
    city: raw.city,
    shiftPattern: raw.shiftPattern,
    // Blank is treated identically to NO, per the spec.
    gstRegistered: raw.gstRegistered.trim().toUpperCase() === 'YES',
    baseShift: required(raw.baseShift, 'Base Shift Rate'),
    additionalLabour: required(raw.additionalLabour, 'Additional Labour'),
    rosteredDayOff: required(raw.rosteredDayOff, 'Rostered Day-off shift'),
    // N/A is legitimate — the contractor simply cannot claim servicing.
    minorService: parseRate(raw.minorService, 'Minor Vehicle Service'),
    majorService: parseRate(raw.majorService, 'Major Vehicle Service'),
    googleReviewBonus: required(raw.googleReviewBonus, 'Google Review Bonus'),
    fuelFilter30: required(raw.fuelFilter30, 'Fuel Filter Sales $30'),
    fuelFilter70: required(raw.fuelFilter70, 'Fuel Filter Sales $70'),
  }
}
