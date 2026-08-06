import type { RateCard } from '@/lib/rates/types'

const NOT_SET = 'Not set — contact WFR accounts'

/**
 * The identity details that print on the contractor's invoice, shown before
 * they fill anything in. A wrong ABN or bank account is only fixable by WFR
 * (both live in INVOICE MATRIX), and once a period is submitted it is locked
 * — so the contractor needs to see these while there is still time to say
 * something. A blank value renders as a prompt, never an empty line: a
 * missing ABN obliges WFR to withhold 47% of the payment, which is precisely
 * what the contractor must notice.
 */
export function ContractorDetails({ rates }: { rates: RateCard }) {
  const rows: Array<{ label: string; value: string }> = [
    { label: 'Address', value: rates.address },
    { label: 'ABN', value: rates.abn },
    { label: 'BSB', value: rates.bankBsb },
    { label: 'Account number', value: rates.bankAccount },
  ]

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <p className="text-lg font-semibold">{rates.name}</p>
      <p className="text-sm" style={{ color: 'var(--wfr-text-muted)' }}>
        {rates.van} · {rates.city} · {rates.shiftPattern}
      </p>
      <p className="mt-1 text-sm" style={{ color: 'var(--wfr-text-muted)' }}>
        {rates.gstRegistered ? 'Registered for GST' : 'Not registered for GST'}
      </p>

      <dl className="mt-3 flex flex-col gap-2 border-t border-gray-100 pt-3 text-sm">
        {rows.map(({ label, value }) => {
          const missing = value.trim() === ''
          return (
            <div key={label} className="flex flex-col">
              <dt className="text-xs" style={{ color: 'var(--wfr-text-muted)' }}>
                {label}
              </dt>
              <dd style={missing ? { color: 'var(--wfr-warning)' } : undefined}>
                {missing ? NOT_SET : value}
              </dd>
            </div>
          )
        })}
      </dl>

      <p className="mt-3 text-xs" style={{ color: 'var(--wfr-text-muted)' }}>
        These details print on your invoice. If any are wrong or missing, contact WFR
        accounts before you submit.
      </p>
    </section>
  )
}
