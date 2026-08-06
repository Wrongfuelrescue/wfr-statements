'use client'

/**
 * Every /manage page reads Airtable at request time. Without this boundary a
 * failed read renders Next's generic error page; worse, any per-page attempt
 * to "handle" it by falling back to empty data would show $0.00 payable,
 * which is indistinguishable from a fortnight nobody submitted for. On a pay
 * run that is the most expensive possible way to be wrong.
 */
export default function ManageError({
  retry,
}: {
  error: Error & { digest?: string }
  /**
   * `retry`, not `reset`: retry re-fetches and re-renders the children, which
   * is the only thing that can help here — the failure is a failed Airtable
   * read. `reset` merely clears the error state without re-fetching, so the
   * button would redisplay the same error. (Next 16 renamed this prop;
   * `reset` still exists but does the wrong thing for this page.)
   */
  retry: () => void
}) {
  return (
    <main className="flex min-h-screen flex-col justify-center">
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold">This page could not be loaded</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--wfr-text-muted)' }}>
          The dashboard could not read from Airtable. Nothing on this screen is
          reliable — do not treat a missing figure as a zero. Try again, and if it
          keeps failing, check the Airtable credentials on the deployment.
        </p>
        <button
          onClick={() => retry()}
          className="mt-4 rounded-lg p-3 text-sm font-semibold text-white"
          style={{ background: 'var(--wfr-accent)' }}
        >
          Try again
        </button>
      </div>
    </main>
  )
}
