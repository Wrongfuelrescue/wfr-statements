import { describe, expect, it } from 'vitest'
import { formatMoney, formatPercent } from '../money'

describe('formatMoney', () => {
  it('formats to two decimal places with a thousands separator', () => {
    expect(formatMoney(1069.99)).toBe('$1,069.99')
    expect(formatMoney(500)).toBe('$500.00')
  })

  it('groups millions', () => {
    expect(formatMoney(1234567.5)).toBe('$1,234,567.50')
  })

  it('formats zero rather than an empty string', () => {
    expect(formatMoney(0)).toBe('$0.00')
  })

  it('puts the sign before the dollar symbol', () => {
    expect(formatMoney(-25.5)).toBe('-$25.50')
  })
})

describe('formatPercent', () => {
  it('renders a share as a whole-number percentage', () => {
    expect(formatPercent(0.8)).toBe('80%')
    expect(formatPercent(0.125)).toBe('13%')
  })

  it('renders zero and one', () => {
    expect(formatPercent(0)).toBe('0%')
    expect(formatPercent(1)).toBe('100%')
  })
})
