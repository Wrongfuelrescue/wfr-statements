import { describe, it, expect } from 'vitest'
import { buildRateCard } from '../rateCard'
import { RateParseError } from '../parse'
import type { RawContractorRecord } from '../types'

// Mirrors HARLEY GATT (rec36VBHdVAy4XyuY) — tier A, GST registered, no servicing.
const tierA: RawContractorRecord = {
  id: 'rec36VBHdVAy4XyuY',
  technician: 'HARLEY GATT',
  abn: '',
  address: '',
  bankAccount: '',
  bankBsb: '',
  van: 'MEL VAN 2',
  city: 'MEL',
  shiftPattern: 'Week on / Week off',
  gstRegistered: 'YES',
  baseShift: '425',
  additionalLabour: '77.27',
  rosteredDayOff: '525',
  minorService: 'N/A',
  majorService: 'N/A',
  googleReviewBonus: '15',
  fuelFilter30: '30',
  fuelFilter70: '70',
}

describe('buildRateCard', () => {
  it('maps a tier A contractor', () => {
    const card = buildRateCard(tierA)
    expect(card.contractorId).toBe('rec36VBHdVAy4XyuY')
    expect(card.name).toBe('HARLEY GATT')
    expect(card.van).toBe('MEL VAN 2')
    expect(card.city).toBe('MEL')
    expect(card.baseShift).toBe(425)
    expect(card.additionalLabour).toBe(77.27)
    expect(card.rosteredDayOff).toBe(525)
  })

  it('maps N/A servicing rates to null', () => {
    const card = buildRateCard(tierA)
    expect(card.minorService).toBeNull()
    expect(card.majorService).toBeNull()
  })

  it('maps a tier B contractor with servicing entitlement', () => {
    const card = buildRateCard({
      ...tierA,
      id: 'recDBjJevrVDmef15',
      technician: 'FERGUS OLIVER',
      gstRegistered: 'NO',
      baseShift: '400',
      additionalLabour: '72.72',
      rosteredDayOff: '500',
      minorService: '72.72',
      majorService: '109.08',
    })
    expect(card.baseShift).toBe(400)
    expect(card.minorService).toBe(72.72)
    expect(card.majorService).toBe(109.08)
    expect(card.gstRegistered).toBe(false)
  })

  it('maps a tier C Monday-Friday contractor', () => {
    const card = buildRateCard({
      ...tierA,
      technician: 'MAC RAINSFORD',
      shiftPattern: 'Monday - Friday',
      baseShift: '325',
      additionalLabour: '76.47',
      rosteredDayOff: '425',
    })
    expect(card.baseShift).toBe(325)
    expect(card.additionalLabour).toBe(76.47)
    expect(card.rosteredDayOff).toBe(425)
    expect(card.shiftPattern).toBe('Monday - Friday')
  })

  it('treats GST YES as registered', () => {
    expect(buildRateCard(tierA).gstRegistered).toBe(true)
  })

  it('treats GST NO as not registered', () => {
    expect(buildRateCard({ ...tierA, gstRegistered: 'NO' }).gstRegistered).toBe(false)
  })

  it('treats blank GST identically to NO', () => {
    expect(buildRateCard({ ...tierA, gstRegistered: '' }).gstRegistered).toBe(false)
  })

  it('is case-insensitive and whitespace-tolerant about GST YES', () => {
    expect(buildRateCard({ ...tierA, gstRegistered: ' yes ' }).gstRegistered).toBe(true)
  })

  it('throws when a required rate is missing', () => {
    expect(() => buildRateCard({ ...tierA, baseShift: '' })).toThrow(RateParseError)
  })

  it('throws when a required rate is unparseable', () => {
    expect(() => buildRateCard({ ...tierA, googleReviewBonus: 'fifteen' })).toThrow(
      RateParseError,
    )
  })

  it('carries the contractor identity fields through', () => {
    const card = buildRateCard({
      ...tierA,
      abn: '12 345 678 901',
      address: '12 Example St, Melbourne VIC 3000',
      bankAccount: '12345678',
      bankBsb: '123-456',
    })
    expect(card.abn).toBe('12 345 678 901')
    expect(card.address).toBe('12 Example St, Melbourne VIC 3000')
    expect(card.bankAccount).toBe('12345678')
    expect(card.bankBsb).toBe('123-456')
  })

  it('leaves identity fields empty rather than undefined when Airtable has none', () => {
    const card = buildRateCard(tierA)
    expect(card.abn).toBe('')
    expect(card.address).toBe('')
    expect(card.bankAccount).toBe('')
    expect(card.bankBsb).toBe('')
  })

  it('trims whitespace from identity fields', () => {
    const card = buildRateCard({ ...tierA, abn: '  12 345 678 901  ' })
    expect(card.abn).toBe('12 345 678 901')
  })

  it('derives standardDayHours from the shift pattern', () => {
    expect(buildRateCard(tierA).standardDayHours).toBe(11)
    expect(
      buildRateCard({ ...tierA, shiftPattern: 'Monday - Friday' }).standardDayHours,
    ).toBe(8.5)
  })

  it('leaves standardDayHours null for an unrecognised shift pattern', () => {
    expect(
      buildRateCard({ ...tierA, shiftPattern: 'Rotating roster' }).standardDayHours,
    ).toBeNull()
  })
})
