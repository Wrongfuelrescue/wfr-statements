import {
  TOOL_DISCLAIMER,
  TOOL_DISCLAIMER_HEADING,
  TOOL_DISCLAIMER_HIGHLIGHT,
} from '@/lib/invoice/toolDisclaimer'

/**
 * WFR's disclaimer, shown before a contractor picks which statement to submit.
 *
 * Two layers, deliberately. The sentence that says a contractor need not use
 * this tool at all — and names the alternative — is always visible; the full
 * four paragraphs sit behind a `<details>` panel. Printing all of it flat would
 * push both submission buttons below the fold on a phone, and a contractor
 * scrolling past a wall of text to reach the thing they came to do reads it
 * less, not more. Collapsing all of it would bury the one claim that does the
 * work. This is the split that avoids both.
 *
 * `<details>` rather than a scripted panel: it opens with no JavaScript, and
 * the body is one activation away for a screen reader. (Collapsed content is
 * removed from the accessibility tree by the browser, so it is reachable
 * rather than read aloud in passing — which is why the highlight above is not
 * inside the panel.)
 *
 * Deliberately not a modal or an "I agree" gate. The text's own point is that
 * using the tool is optional and imposes nothing; a forced acknowledgement
 * would manufacture the very condition the paragraphs exist to deny. The
 * declaration on the review screen is the thing a contractor actively agrees
 * to. This is notice, not a contract.
 */
export function ToolDisclaimer() {
  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <p className="text-sm">{TOOL_DISCLAIMER_HIGHLIGHT}</p>

      <details className="mt-3 border-t border-gray-100 pt-3">
        <summary className="cursor-pointer text-sm font-semibold">
          {TOOL_DISCLAIMER_HEADING}
        </summary>
        <div className="mt-3 flex flex-col gap-2">
          {TOOL_DISCLAIMER.map((paragraph) => (
            <p key={paragraph} className="text-sm" style={{ color: 'var(--wfr-text-muted)' }}>
              {paragraph}
            </p>
          ))}
        </div>
      </details>
    </section>
  )
}
