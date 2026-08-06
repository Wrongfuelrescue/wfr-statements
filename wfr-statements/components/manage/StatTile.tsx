export function StatTile({
  label,
  value,
  hint,
  tone = 'normal',
}: {
  label: string
  value: string
  hint?: string
  /** `problem` colours the figure red — for a number that needs acting on. */
  tone?: 'normal' | 'problem'
}) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="text-sm" style={{ color: 'var(--wfr-text-muted)' }}>
        {label}
      </p>
      <p
        className="mt-1 text-2xl font-semibold tabular-nums"
        style={tone === 'problem' ? { color: 'var(--wfr-error)' } : undefined}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs" style={{ color: 'var(--wfr-text-muted)' }}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}
