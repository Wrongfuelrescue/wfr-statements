/**
 * Rendered above the form when a contractor's ABN is blank in INVOICE
 * MATRIX (Finding B, whole-branch review). Until now the only signal that a
 * contractor's invoice will be incomplete went to Airtable's `Warnings`
 * column — the contractor themselves saw nothing, so a GST-registered
 * contractor could submit, get a `TAX INVOICE` with no supplier ABN, and
 * only find out (if ever) once WFR noticed. Submission is deliberately not
 * blocked here: the contractor cannot fix this themselves (the field lives
 * on INVOICE MATRIX, not anything they enter), so blocking would leave them
 * unable to claim at all — this is purely advance notice.
 */
export function NoAbnWarning() {
  return (
    <p
      role="alert"
      className="mb-4 rounded-lg p-3 text-sm"
      style={{ background: 'var(--wfr-warning-bg)', color: 'var(--wfr-warning)' }}
    >
      <strong>WFR hasn&apos;t added your ABN yet.</strong> Your invoice will be incomplete until
      they do. Contact WFR accounts before submitting.
    </p>
  )
}
