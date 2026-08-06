import { BrandHeader } from '@/components/BrandHeader'
import { BreakdownBars } from '@/components/manage/BreakdownBars'
import { ManageNav } from '@/components/manage/ManageNav'
import { PeriodStepper } from '@/components/manage/PeriodStepper'
import { StatTile } from '@/components/manage/StatTile'
import { formatMoney } from '@/components/manage/money'
import {
  listLinesForStatements,
  listRoster,
  listStatementsInRange,
} from '@/lib/airtable/management'
import { requireManager } from '@/lib/auth/requireManager'
import { currentQuarter, quarterFor, stepQuarter } from '@/lib/manage/quarter'
import { rollUpByDimension, rollUpByGroup } from '@/lib/manage/rollup'

export const dynamic = 'force-dynamic'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export default async function CostsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  await requireManager()

  const requested = (await searchParams).q
  const quarter =
    requested && ISO_DATE.test(requested) ? quarterFor(requested) : currentQuarter(new Date())

  const statements = await listStatementsInRange(quarter.start, quarter.end)
  const payable = statements.filter((s) => s.status === 'Submitted')

  const [lines, roster] = await Promise.all([
    listLinesForStatements(payable.map((s) => ({ id: s.id, label: s.label }))),
    listRoster(),
  ])

  // Ex-GST: the total minus GST, which WFR reclaims. Matches the basis used
  // by rollUpByDimension, so the three breakdowns are comparable.
  const totalCost = payable.reduce((running, s) => running + s.subtotal + s.reimbursements, 0)

  return (
    <main className="flex flex-col gap-6">
      <BrandHeader subtitle="Management" />
      <ManageNav current="costs" />

      <PeriodStepper
        label={quarter.label}
        prevHref={`/manage/costs?q=${stepQuarter(quarter, -1).start}`}
        nextHref={`/manage/costs?q=${stepQuarter(quarter, 1).start}`}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile
          label="Total cost"
          value={formatMoney(Number(totalCost.toFixed(2)))}
          hint="Excluding GST"
        />
        <StatTile label="Statements" value={String(payable.length)} />
        <StatTile label="Line items" value={String(lines.length)} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <BreakdownBars title="By category" slices={rollUpByGroup(lines)} />
        <BreakdownBars title="By city" slices={rollUpByDimension(payable, roster, 'city')} />
        <BreakdownBars title="By van" slices={rollUpByDimension(payable, roster, 'van')} />
      </div>

      <p className="text-sm" style={{ color: 'var(--wfr-text-muted)' }}>
        City and van are read live from INVOICE MATRIX, not frozen onto each statement, so a
        contractor who changes van re-attributes their whole history to the new one. Amounts
        exclude GST, which WFR reclaims.
      </p>
    </main>
  )
}
