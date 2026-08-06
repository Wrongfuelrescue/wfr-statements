'use client'

import { useState } from 'react'
import { formatDisplayDate } from '@/lib/dates'
import { roundMoney } from '@/lib/calc/money'
import type { DayEntry, ServiceType, ShiftType } from '@/lib/calc/types'
import type { RateCard } from '@/lib/rates/types'

// Each term is rounded individually before summing, mirroring how
// calculateFortnightly rounds every line it produces. Summing unrounded
// fractional-cent terms and rounding once is a different operation — on a
// day with two such terms (e.g. an adjusted shift plus additional labour)
// it can land a cent away from what calculateFortnightly reports, showing
// two different figures for the same money at the same time.
function dayTotal(entry: DayEntry, rates: RateCard): number {
  let total = 0
  if (entry.shift === 'base') total += roundMoney(rates.baseShift)
  if (entry.shift === 'rdo') total += roundMoney(rates.rosteredDayOff)
  if (entry.shift === 'adjusted' && rates.standardDayHours !== null) {
    total += roundMoney((entry.adjustedHours / rates.standardDayHours) * rates.baseShift)
  }
  if (entry.additionalLabourHours > 0) {
    total += roundMoney(entry.additionalLabourHours * rates.additionalLabour)
  }
  if (entry.service === 'minor' && rates.minorService) total += roundMoney(rates.minorService)
  if (entry.service === 'major' && rates.majorService) total += roundMoney(rates.majorService)
  return roundMoney(total)
}

export function DayCard({
  entry,
  rates,
  onChange,
  defaultOpen = false,
}: {
  entry: DayEntry
  rates: RateCard
  onChange: (next: DayEntry) => void
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const total = dayTotal(entry, rates)
  const canClaimService = rates.minorService !== null || rates.majorService !== null

  return (
    <div className="rounded-xl bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <span className="font-medium">{formatDisplayDate(entry.date)}</span>
        <span
          className="text-sm font-semibold"
          style={{ color: total > 0 ? 'var(--wfr-accent)' : 'var(--wfr-text-muted)' }}
        >
          {total > 0 ? `$${total.toFixed(2)}` : '— no work —'}
        </span>
      </button>

      {open ? (
        <div className="flex flex-col gap-4 border-t border-gray-100 p-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Shift</legend>
            {(
              [
                ['none', 'None'],
                ['base', 'Base shift'],
                ['rdo', 'Rostered day-off shift'],
                ...(rates.standardDayHours !== null
                  ? ([['adjusted', 'Adjusted shift']] as Array<[ShiftType, string]>)
                  : []),
              ] as Array<[ShiftType, string]>
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={`shift-${entry.date}`}
                  aria-label={label}
                  checked={entry.shift === value}
                  onChange={() =>
                    onChange({
                      ...entry,
                      shift: value,
                      adjustedHours: value === 'adjusted' ? entry.adjustedHours : 0,
                    })
                  }
                />
                {label}
                {value === 'base' ? ` — $${rates.baseShift.toFixed(2)}` : ''}
                {value === 'rdo' ? ` — $${rates.rosteredDayOff.toFixed(2)}` : ''}
              </label>
            ))}
          </fieldset>

          {entry.shift === 'adjusted' && rates.standardDayHours !== null ? (
            <label className="flex flex-col gap-1 text-sm font-medium">
              Hours worked (of {rates.standardDayHours})
              <input
                type="number"
                min={0}
                max={rates.standardDayHours}
                step={0.25}
                value={entry.adjustedHours || ''}
                onChange={(e) =>
                  onChange({
                    ...entry,
                    adjustedHours: Math.min(
                      rates.standardDayHours as number,
                      Math.max(0, Number(e.target.value) || 0),
                    ),
                  })
                }
                className="rounded-lg border border-gray-300 p-3 text-base"
              />
            </label>
          ) : null}

          <label className="flex flex-col gap-1 text-sm font-medium">
            Additional labour (hours at ${rates.additionalLabour.toFixed(2)}/hr)
            <input
              type="number"
              min={0}
              step={0.25}
              value={entry.additionalLabourHours || ''}
              onChange={(e) =>
                onChange({
                  ...entry,
                  additionalLabourHours: Math.max(0, Number(e.target.value) || 0),
                })
              }
              className="rounded-lg border border-gray-300 p-3 text-base"
            />
          </label>

          {canClaimService ? (
            <label className="flex flex-col gap-1 text-sm font-medium">
              Vehicle service
              <select
                value={entry.service}
                onChange={(e) =>
                  onChange({ ...entry, service: e.target.value as ServiceType })
                }
                className="rounded-lg border border-gray-300 p-3 text-base"
              >
                <option value="none">None</option>
                {rates.minorService !== null ? (
                  <option value="minor">Minor — ${rates.minorService.toFixed(2)}</option>
                ) : null}
                {rates.majorService !== null ? (
                  <option value="major">Major — ${rates.majorService.toFixed(2)}</option>
                ) : null}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
