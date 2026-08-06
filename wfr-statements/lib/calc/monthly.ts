import type { RateCard } from '@/lib/rates/types'
import { roundMoney } from './money'
import { rollUpTotals } from './totals'
import type { BonusEntry, LineType, StatementLine, StatementTotals } from './types'

function validateCount(count: number, label: string): void {
  if (count < 0) throw new Error(`${label} count cannot be negative.`)
  if (!Number.isInteger(count)) throw new Error(`${label} count must be a whole number.`)
}

export function calculateMonthly(
  bonus: BonusEntry,
  rates: RateCard,
): StatementTotals {
  validateCount(bonus.googleReviews, 'Google review')
  validateCount(bonus.fuelFilter30, 'Fuel filter $30')
  validateCount(bonus.fuelFilter70, 'Fuel filter $70')

  const claims: Array<{ count: number; lineType: LineType; rate: number }> = [
    { count: bonus.googleReviews, lineType: 'Google Review Bonus', rate: rates.googleReviewBonus },
    { count: bonus.fuelFilter30, lineType: 'Fuel Filter Sales Bonus $30', rate: rates.fuelFilter30 },
    { count: bonus.fuelFilter70, lineType: 'Fuel Filter Sales Bonus $70', rate: rates.fuelFilter70 },
  ]

  const lines: StatementLine[] = claims
    .filter((c) => c.count > 0)
    .map((c) => ({
      // Bonus lines are period-wide, not tied to a specific date.
      date: null,
      lineType: c.lineType,
      quantity: c.count,
      // Rounded so the printed statement line reconciles: qty x rate = amount.
      unitRate: roundMoney(c.rate),
      amount: roundMoney(c.count * c.rate),
      description: '',
      // Bonuses are earnings and, like labour hire, attract GST when the
      // contractor is registered. Agreed rates are GST-exclusive, so the 10%
      // is added on top by rollUpTotals rather than being carved out.
      gstBearing: true,
    }))

  // A statement-level remark, not a line-level one: the note describes the
  // whole month, not whichever bonus line happens to come first, which may
  // be entirely unrelated to what the note is about (e.g. fuel filters, when
  // the first line is a Google Review Bonus). Rendered as a standalone
  // remark below the table rather than glued onto a line's description.
  const note = bonus.note.trim()

  return { ...rollUpTotals(lines, rates.gstRegistered), note: note === '' ? null : note }
}
