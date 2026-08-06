import { describe, expect, it } from 'vitest'
import {
  FUEL_FILTER_SALE_PRICE_30,
  FUEL_FILTER_SALE_PRICE_70,
  formatSalePrice,
} from '../bonusSalePrices'

describe('fuel filter sale prices', () => {
  it('carries the two agreed sale prices', () => {
    expect(FUEL_FILTER_SALE_PRICE_30).toBe(79.5)
    expect(FUEL_FILTER_SALE_PRICE_70).toBe(149)
  })

  it('drops trailing cents from a whole-dollar price', () => {
    expect(formatSalePrice(149)).toBe('$149')
    expect(formatSalePrice(79.5)).toBe('$79.50')
  })
})
