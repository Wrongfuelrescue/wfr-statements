import { describe, it, expect, vi, afterEach } from 'vitest'
import { generateStatementReference } from '../reference'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('generateStatementReference', () => {
  it('is prefixed INV- followed by eight characters', () => {
    expect(generateStatementReference()).toMatch(/^INV-.{8}$/)
  })

  it('only uses uppercase letters and digits that cannot be mistaken for one another', () => {
    // I, O, 0 and 1 are excluded: easy to mis-hear or mis-type as each other
    // (or as a lowercase L) when a contractor reads this off the phone.
    for (let i = 0; i < 50; i++) {
      expect(generateStatementReference()).toMatch(/^INV-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/)
    }
  })

  it('is derived deterministically from crypto.randomUUID, given a fixed UUID', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(
      '00112233-4455-6677-8899-aabbccddeeff' as `${string}-${string}-${string}-${string}-${string}`,
    )
    // Bytes: 00 11 22 33 44 55 66 77 (first 8 of the UUID), each mod 32
    // indexes into the reference alphabet 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.
    expect(generateStatementReference()).toBe('INV-ATCVEXGZ')
  })

  it('produces different references on successive calls', () => {
    const first = generateStatementReference()
    const second = generateStatementReference()
    expect(first).not.toBe(second)
  })
})
