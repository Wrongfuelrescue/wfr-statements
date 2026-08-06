import Link from 'next/link'

export function PeriodStepper({
  label,
  prevHref,
  nextHref,
}: {
  label: string
  prevHref: string
  nextHref: string
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-white p-3 shadow-sm">
      <Link
        href={prevHref}
        aria-label="Previous period"
        className="rounded-lg px-3 py-2 text-sm font-medium"
        style={{ color: 'var(--wfr-accent)' }}
      >
        ← Previous
      </Link>
      <p className="text-center text-sm font-semibold">{label}</p>
      <Link
        href={nextHref}
        aria-label="Next period"
        className="rounded-lg px-3 py-2 text-sm font-medium"
        style={{ color: 'var(--wfr-accent)' }}
      >
        Next →
      </Link>
    </div>
  )
}
