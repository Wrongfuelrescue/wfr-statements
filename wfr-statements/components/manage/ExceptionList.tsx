import Link from 'next/link'
import type { ExceptionKind, ExceptionRow } from '@/lib/manage/exceptions'

/**
 * Severity, not category colour. `incomplete` and `superseded` mean a figure
 * must not be paid; the rest mean something needs chasing.
 */
const TONE: Record<ExceptionKind, { bg: string; fg: string }> = {
  incomplete: { bg: 'var(--wfr-error-bg)', fg: 'var(--wfr-error)' },
  superseded: { bg: 'var(--wfr-error-bg)', fg: 'var(--wfr-error)' },
  'no-abn': { bg: 'var(--wfr-error-bg)', fg: 'var(--wfr-error)' },
  warnings: { bg: 'var(--wfr-warning-bg)', fg: 'var(--wfr-warning)' },
  'off-cycle': { bg: 'var(--wfr-warning-bg)', fg: 'var(--wfr-warning)' },
}

export function ExceptionList({ rows }: { rows: ExceptionRow[] }) {
  if (rows.length === 0) {
    return (
      <p
        className="rounded-xl p-6 text-sm shadow-sm"
        style={{ background: 'var(--wfr-success-bg)', color: 'var(--wfr-success)' }}
      >
        Nothing needs attention for this quarter.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row, index) => (
        <li
          key={`${row.kind}-${row.statementId ?? row.subject}-${index}`}
          className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-sm"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded px-2 py-0.5 text-xs font-medium"
              style={{ background: TONE[row.kind].bg, color: TONE[row.kind].fg }}
            >
              {row.title}
            </span>
            {row.statementId ? (
              <Link
                href={`/manage/statements/${row.statementId}`}
                className="text-sm font-medium underline"
              >
                {row.subject}
              </Link>
            ) : (
              <span className="text-sm font-medium">{row.subject}</span>
            )}
          </div>

          <p className="text-sm">{row.detail}</p>

          <p className="text-sm" style={{ color: 'var(--wfr-text-muted)' }}>
            <span className="font-medium">Fix: </span>
            {row.fix}
          </p>
        </li>
      ))}
    </ul>
  )
}
