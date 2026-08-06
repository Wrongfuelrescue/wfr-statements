// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import { verifyManagerPassphrase } from '../managerPassphrase'

afterEach(() => {
  delete process.env.MANAGER_PASSPHRASE
})

describe('verifyManagerPassphrase', () => {
  it('accepts the configured passphrase', () => {
    process.env.MANAGER_PASSPHRASE = 'correct horse battery staple'
    expect(verifyManagerPassphrase('correct horse battery staple')).toBe(true)
  })

  it('rejects a wrong passphrase', () => {
    process.env.MANAGER_PASSPHRASE = 'correct horse battery staple'
    expect(verifyManagerPassphrase('wrong')).toBe(false)
  })

  it('rejects a passphrase that is only a prefix of the real one', () => {
    process.env.MANAGER_PASSPHRASE = 'correct horse battery staple'
    expect(verifyManagerPassphrase('correct horse')).toBe(false)
  })

  /**
   * Fails closed. An unset passphrase must never mean "anything is accepted",
   * which is what a naive `submitted === process.env.MANAGER_PASSPHRASE`
   * would do for an empty submission against an undefined variable.
   */
  it('rejects everything when MANAGER_PASSPHRASE is not set', () => {
    expect(verifyManagerPassphrase('')).toBe(false)
    expect(verifyManagerPassphrase('anything')).toBe(false)
  })

  it('rejects everything when MANAGER_PASSPHRASE is set to an empty string', () => {
    process.env.MANAGER_PASSPHRASE = ''
    expect(verifyManagerPassphrase('')).toBe(false)
  })
})
