import Link from 'next/link'
import { BrandHeader } from '@/components/BrandHeader'
import { ManageNav } from '@/components/manage/ManageNav'
import { PayRunTable } from '@/components/manage/PayRunTable'
import { PeriodStepper } from '@/components/manage/PeriodStepper'
import { StatTile } from '@/components/manage/StatTile'
import { formatMoney } from '@/components/manage/money'
import { listRoster, listStatementsInRange } from '@/lib/airtable/management'
import { requireManager } from '@/lib/auth/requireManager'
import { addDays, formatDisplayDateWithYear } from '@/lib/dates'
import {
  currentFortnightEnd,
  fortnightWindow,
  isOnCycle,
  stepFortnight,
} from '@/lib/manage/fortnight'
import { buildPayRun } from '@/lib/manage/rollup'

export const dynamic = 'force-dynamic'

/**
 * Widens the Airtable read beyond the fortnight itself so a Monthly Bonus
 * statement whose period ends inside this window is still fetched. The
 * bucketing is done by buildPayRun, not by the query.
 */
const READ_MARGIN_DAYS = 31

export default async function PayRunPage({
  searchParams,
}: {
  searchParams: Promise<{ end?: string }>
}) {
  await requireManager()

  const requested = (await searchParams).end
  // Only an on-cycle boundary is a valid fortnight. Anything else in the URL
  // falls back to the current one rather than rendering a nonsense period.
  const end = requested && isOnCycle(requested) ? requested : currentFortnightEnd(new Date())
  const window = fortnightWindow(end)

  const [statements, roster] = await Promise.all([
    listStatementsInRange(
      addDays(window.start, -READ_MARGIN_DAYS),
      addDays(window.end, READ_MARGIN_DAYS),
    ),
    listRoster(),
  ])

  const run = buildPayRun(end, statements, roster)
  const outstanding = run.expectedCount - run.submittedCount

  return (
    <main className="flex flex-col gap-6">
      <BrandHeader subtitle="Management" />
      <ManageNav current="pay-run" />

      <PeriodStepper
        label={`${formatDisplayDateWithYear(window.start)} – ${formatDisplayDateWithYear(window.end)}`}
        prevHref={`/manage/pay-run?end=${stepFortnight(end, -1)}`}
        nextHref={`/manage/pay-run?end=${stepFortnight(end, 1)}`}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Total payable" value={formatMoney(run.totalPayable)} />
        <StatTile
          label="Submitted"
          value={`${run.submittedCount} of ${run.expectedCount}`}
          hint={outstanding === 0 ? 'All in' : `${outstanding} outstanding`}
          tone={outstanding > 0 ? 'problem' : 'normal'}
        />
        <StatTile label="GST included" value={formatMoney(run.totalGst)} />
        <StatTile label="Reimbursements" value={formatMoney(run.totalReimbursements)} />
      </div>

      <PayRunTable rows={run.rows} />

      {run.bonuses.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Monthly bonuses in this fortnight</h2>
          <p className="text-sm" style={{ color: 'var(--wfr-text-muted)' }}>
            Included in total payable. Nobody is expected to claim a bonus, so there is no
            outstanding list for these.
          </p>
          <ul className="flex flex-col gap-2">
            {run.bonuses.map((bonus) => (
              <li
                key={bonus.id}
                className="flex justify-between gap-3 rounded-xl bg-white p-3 text-sm shadow-sm"
              >
                <Link href={`/manage/statements/${bonus.id}`} className="underline">
                  {bonus.contractorName} — {bonus.periodStart} to {bonus.periodEnd}
                </Link>
                <span className="font-semibold tabular-nums">{formatMoney(bonus.total)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  )
}
