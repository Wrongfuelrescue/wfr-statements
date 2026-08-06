'use client'

import Link from 'next/link'
import { ClaimSummary } from './ClaimSummary'
import type { StatementTotals } from '@/lib/calc/types'

/**
 * Replaces the form after a successful submit.
 *
 * This screen owns the download. The app never triggers one itself: iOS
 * Safari ignores the `download` attribute on a blob: URL and navigates the
 * tab to the PDF, which destroyed the page and left contractors staring at
 * their invoice with no way back into the app. Handing them a link they tap
 * themselves, opening in a new tab, means nothing ever navigates this tab
 * away.
 *
 * It also deliberately keeps showing what was submitted (via `ClaimSummary`)
 * rather than resetting to blank. A contractor who submitted by accident
 * needs to see what went, not a wiped form. And the statement is already
 * saved by the time this renders, so nothing here invites a second submit.
 */
export function SubmissionSuccess({
  totals,
  periodLabel,
  pdfUrl = null,
  pdfFilename = '',
}: {
  totals: StatementTotals
  periodLabel: string
  /**
   * The object URL of the PDF that was just generated, kept alive by the form
   * until it unmounts. Null only if the submission somehow produced no file,
   * in which case the contractor is pointed at My submissions instead of a
   * dead button.
   */
  pdfUrl?: string | null
  pdfFilename?: string
}) {
  return (
    <div className="flex flex-col gap-4 pb-4">
      <section
        role="status"
        className="rounded-xl p-4 shadow-sm"
        style={{ background: 'var(--wfr-success-bg)', color: 'var(--wfr-success)' }}
      >
        <p className="text-base font-semibold">Statement submitted</p>
        <p className="mt-1 text-sm">
          {pdfUrl
            ? 'Your invoice is ready. Open it below to save or send it — it opens in a new tab, so this page stays where it is.'
            : 'Your invoice was saved. You can download it any time from My submissions.'}
        </p>
      </section>

      {pdfUrl ? (
        <a
          href={pdfUrl}
          download={pdfFilename}
          // New tab, always. On a phone this is what keeps the app alive
          // behind the PDF; on a desktop the browser honours `download` and
          // saves the file without opening anything.
          target="_blank"
          rel="noopener"
          className="rounded-lg p-4 text-center text-base font-semibold text-white"
          style={{ background: 'var(--wfr-accent)' }}
        >
          Open your invoice
        </a>
      ) : null}

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <p className="text-sm font-medium">Period</p>
        <p className="text-base">{periodLabel}</p>
      </section>

      <ClaimSummary totals={totals} />

      <Link
        href="/statements"
        className="rounded-lg bg-white p-4 text-center text-base font-semibold shadow-sm"
      >
        Back to statements
      </Link>
    </div>
  )
}
