import type { Slice } from '@/lib/manage/rollup'
import { formatMoney, formatPercent } from './money'

/**
 * A single-series magnitude breakdown, so every bar carries the same hue:
 * length encodes the value and colour would be decoration competing with it.
 * That also means no legend — the title names the series. Plain CSS rather
 * than a charting library; this is a handful of categories, not a plot.
 */
export function BreakdownBars({ title, slices }: { title: string; slices: Slice[] }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold">{title}</h2>

      {slices.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--wfr-text-muted)' }}>
          Nothing to show for this quarter.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {slices.map((slice) => (
            <li
              key={slice.key}
              role="img"
              aria-label={`${slice.key}: ${formatMoney(slice.amount)}, ${formatPercent(
                slice.share,
              )} of total`}
              className="flex flex-col gap-1"
            >
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium">{slice.key}</span>
                <span className="flex items-baseline gap-2 tabular-nums">
                  <span className="font-semibold">{formatMoney(slice.amount)}</span>
                  <span className="text-xs" style={{ color: 'var(--wfr-text-muted)' }}>
                    {formatPercent(slice.share)}
                  </span>
                </span>
              </div>
              <div className="h-2 w-full rounded-full" style={{ background: 'var(--wfr-surface)' }}>
                <div
                  data-bar
                  className="h-2 rounded-full"
                  style={{
                    width: `${slice.share * 100}%`,
                    background: 'var(--wfr-primary)',
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
