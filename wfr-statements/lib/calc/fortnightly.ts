import type { RateCard } from '@/lib/rates/types'
import { roundMoney } from './money'
import { rollUpTotals } from './totals'
import type { DayEntry, Reimbursement, StatementLine, StatementTotals } from './types'

export class ClaimNotPermittedError extends Error {
  readonly lineType: string

  constructor(lineType: string) {
    super(
      `This contractor is not entitled to claim ${lineType} — their agreed rate is N/A. ` +
        'Contact WFR accounts if this is wrong.',
    )
    this.name = 'ClaimNotPermittedError'
    this.lineType = lineType
  }
}

export function calculateFortnightly(
  days: DayEntry[],
  reimbursement: Reimbursement,
  rates: RateCard,
): StatementTotals {
  const lines: StatementLine[] = []
  const ordered = [...days].sort((a, b) => a.date.localeCompare(b.date))

  for (const day of ordered) {
    if (day.additionalLabourHours < 0) {
      throw new Error(`Additional labour hours cannot be negative (${day.date}).`)
    }

    if (day.shift === 'base') {
      lines.push({
        date: day.date,
        lineType: 'Sub Contractor Labour Hire',
        quantity: 1,
        unitRate: roundMoney(rates.baseShift),
        amount: roundMoney(rates.baseShift),
        description: '',
        gstBearing: true,
      })
    } else if (day.shift === 'rdo') {
      lines.push({
        date: day.date,
        lineType: 'Sub Contractor Labour Hire – RDA Rate',
        quantity: 1,
        unitRate: roundMoney(rates.rosteredDayOff),
        amount: roundMoney(rates.rosteredDayOff),
        description: '',
        gstBearing: true,
      })
    } else if (day.shift === 'adjusted') {
      if (rates.standardDayHours === null) {
        throw new ClaimNotPermittedError('Adjusted Shift')
      }
      // !(x > 0) rather than x <= 0: rejects NaN and undefined too, both of
      // which pass a bare `<= 0` check (NaN <= 0 is false, undefined <= 0 is
      // false) and would otherwise flow through to a NaN amount.
      if (!(day.adjustedHours > 0)) {
        throw new Error(`An adjusted shift on ${day.date} needs the hours worked.`)
      }
      if (day.adjustedHours > rates.standardDayHours) {
        throw new Error(
          `An adjusted shift on ${day.date} cannot exceed a full day of ` +
            `${rates.standardDayHours} hours. For a longer day, claim a base shift ` +
            'plus additional labour.',
        )
      }
      {
        const amount = roundMoney((day.adjustedHours / rates.standardDayHours) * rates.baseShift)
        lines.push({
          date: day.date,
          lineType: 'Sub Contractor Labour Hire – Adjusted Hours',
          // Quantity pinned to 1 and unitRate set equal to amount, rather
          // than the hours worked and an independently-rounded hourly rate —
          // rounding unitRate and amount separately let them land a cent
          // apart, so qty x rate no longer equalled amount on the printed
          // line. The hours worked are still shown, in the description.
          quantity: 1,
          unitRate: amount,
          amount,
          description: `${day.adjustedHours} of ${rates.standardDayHours} hours`,
          gstBearing: true,
        })
      }
    }

    if (day.additionalLabourHours > 0) {
      lines.push({
        date: day.date,
        lineType: 'Sub Contractor Labour Hire – Additional Hours',
        quantity: day.additionalLabourHours,
        unitRate: roundMoney(rates.additionalLabour),
        amount: roundMoney(day.additionalLabourHours * rates.additionalLabour),
        description: '',
        gstBearing: true,
      })
    }

    if (day.service === 'minor') {
      if (rates.minorService === null) throw new ClaimNotPermittedError('Minor Service')
      lines.push({
        date: day.date,
        lineType: 'Minor Service',
        quantity: 1,
        unitRate: roundMoney(rates.minorService),
        amount: roundMoney(rates.minorService),
        description: '',
        gstBearing: true,
      })
    } else if (day.service === 'major') {
      if (rates.majorService === null) throw new ClaimNotPermittedError('Major Service')
      lines.push({
        date: day.date,
        lineType: 'Major Service',
        quantity: 1,
        unitRate: roundMoney(rates.majorService),
        amount: roundMoney(rates.majorService),
        description: '',
        gstBearing: true,
      })
    }

  }

  if (reimbursement.amount < 0) {
    throw new Error('Reimbursement amount cannot be negative.')
  }
  if (reimbursement.amount > 0) {
    if (reimbursement.description.trim() === '') {
      throw new Error('The reimbursement needs a description of what it was for.')
    }
    lines.push({
      // Fortnight-level, not tied to a day.
      date: null,
      lineType: 'Reimbursement',
      quantity: 1,
      unitRate: roundMoney(reimbursement.amount),
      amount: roundMoney(reimbursement.amount),
      description: reimbursement.description.trim(),
      // Pass-through expense — never GST-bearing.
      gstBearing: false,
    })
  }

  return rollUpTotals(lines, rates.gstRegistered)
}
