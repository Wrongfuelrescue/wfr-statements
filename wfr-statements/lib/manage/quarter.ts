/**
 * Australian BAS quarters: Jul–Sep, Oct–Dec, Jan–Mar, Apr–Jun. GST totals
 * reported on these boundaries line up with what actually goes on the BAS.
 * Dates are bare yyyy-mm-dd handled in UTC, matching lib/dates.ts.
 */
export type Quarter = { label: string; start: string; end: string }

const LABELS = ['Jan–Mar', 'Apr–Jun', 'Jul–Sep', 'Oct–Dec'] as const

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function build(year: number, index: number): Quarter {
  const startMonth = index * 3 + 1
  // Day 0 of the month after the quarter's last month is that month's last day.
  const lastDay = new Date(Date.UTC(year, startMonth + 2, 0)).getUTCDate()
  return {
    label: `${LABELS[index]} ${year}`,
    start: `${year}-${pad(startMonth)}-01`,
    end: `${year}-${pad(startMonth + 2)}-${pad(lastDay)}`,
  }
}

export function quarterFor(dateIso: string): Quarter {
  const [year, month] = dateIso.split('-').map(Number)
  return build(year, Math.floor((month - 1) / 3))
}

export function currentQuarter(today: Date): Quarter {
  return quarterFor(today.toISOString().slice(0, 10))
}

export function stepQuarter(quarter: Quarter, direction: 1 | -1): Quarter {
  const [year, month] = quarter.start.split('-').map(Number)
  const absolute = year * 4 + Math.floor((month - 1) / 3) + direction
  return build(Math.floor(absolute / 4), absolute % 4)
}
