import { BrandHeader } from '@/components/BrandHeader'
import { ExceptionList } from '@/components/manage/ExceptionList'
import { ManageNav } from '@/components/manage/ManageNav'
import { PeriodStepper } from '@/components/manage/PeriodStepper'
import { StatTile } from '@/components/manage/StatTile'
import { listRoster, listStatementsInRange } from '@/lib/airtable/management'
import { requireManager } from '@/lib/auth/requireManager'
import { findExceptions, type ExceptionKind } from '@/lib/manage/exceptions'
import { currentQuarter, quarterFor, stepQuarter } from '@/lib/manage/quarter'

export const dynamic = 'force-dynamic'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const TILES: Array<{ kind: ExceptionKind; label: string }> = [
  { kind: 'warnings', label: 'Warnings' },
  { kind: 'incomplete', label: 'Incomplete writes' },
  { kind: 'superseded', label: 'Superseded' },
  { kind: 'off-cycle', label: 'Off-cycle periods' },
  { kind: 'no-abn', label: 'No ABN on file' },
]

export default async function ExceptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  await requireManager()

  const requested = (await searchParams).q
  const quarter =
    requested && ISO_DATE.test(requested) ? quarterFor(requested) : currentQuarter(new Date())

  const [statements, roster] = await Promise.all([
    listStatementsInRange(quarter.start, quarter.end),
    listRoster(),
  ])

  const rows = findExceptions(statements, roster)

  return (
    <main className="flex flex-col gap-6">
      <BrandHeader subtitle="Management" />
      <ManageNav current="exceptions" />

      <PeriodStepper
        label={quarter.label}
        prevHref={`/manage/exceptions?q=${stepQuarter(quarter, -1).start}`}
        nextHref={`/manage/exceptions?q=${stepQuarter(quarter, 1).start}`}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {TILES.map((tile) => {
          const count = rows.filter((row) => row.kind === tile.kind).length
          return (
            <StatTile
              key={tile.kind}
              label={tile.label}
              value={String(count)}
              tone={count > 0 ? 'problem' : 'normal'}
            />
          )
        })}
      </div>

      <ExceptionList rows={rows} />

      <p className="text-sm" style={{ color: 'var(--wfr-text-muted)' }}>
        Statement-level checks cover this quarter. The ABN check is not period-bound — it runs
        across every contractor who can log in.
      </p>
    </main>
  )
}
