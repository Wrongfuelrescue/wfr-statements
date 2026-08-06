import { describe, expect, it } from 'vitest'
import { CONTRACTOR_DECLARATION, validateDeclaration } from '../declaration'

describe('CONTRACTOR_DECLARATION', () => {
  it('is the agreed text, word for word', () => {
    expect(CONTRACTOR_DECLARATION).toBe(
      'I confirm that I am submitting this invoice in the course of my independent ' +
        'business. I have reviewed and approved the services, dates, fees, GST treatment ' +
        'and payment details shown. I confirm that the services were supplied and that I ' +
        'am authorised to issue this invoice.',
    )
  })
})

describe('validateDeclaration', () => {
  it('accepts an explicit acceptance', () => {
    expect(validateDeclaration(true)).toBe(true)
  })

  it('rejects anything else, including a truthy value that is not true', () => {
    for (const value of [false, undefined, null, 'true', 1]) {
      expect(() => validateDeclaration(value)).toThrow(/declaration/i)
    }
  })
})
