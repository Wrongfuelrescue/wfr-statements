import { describe, it, expect } from 'vitest'
import { assertRecordId, InvalidRecordIdError } from '../recordId'

describe('assertRecordId', () => {
  it('accepts a well-formed Airtable record id', () => {
    expect(() => assertRecordId('rec36VBHdVAy4XyuY')).not.toThrow()
  })

  it('rejects an empty string', () => {
    expect(() => assertRecordId('')).toThrow(InvalidRecordIdError)
  })

  it('rejects a value missing the rec prefix', () => {
    expect(() => assertRecordId('36VBHdVAy4XyuYabcd')).toThrow(InvalidRecordIdError)
  })

  it('rejects a path-traversal attempt', () => {
    expect(() => assertRecordId('rec123/../../secret')).toThrow(InvalidRecordIdError)
  })

  it('rejects a formula-injection attempt', () => {
    expect(() => assertRecordId('rec"OR 1=1"')).toThrow(InvalidRecordIdError)
  })

  it('rejects a value with the right prefix but wrong length', () => {
    expect(() => assertRecordId('recTooShort')).toThrow(InvalidRecordIdError)
  })

  it('rejects a non-string value', () => {
    // @ts-expect-error deliberately passing a non-string to prove the runtime guard
    expect(() => assertRecordId(12345)).toThrow(InvalidRecordIdError)
  })
})
