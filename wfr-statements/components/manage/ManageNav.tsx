import Link from 'next/link'

const TABS = [
  { key: 'pay-run', href: '/manage/pay-run', label: 'Pay run' },
  { key: 'gst', href: '/manage/gst', label: 'GST' },
  { key: 'costs', href: '/manage/costs', label: 'Costs' },
  { key: 'exceptions', href: '/manage/exceptions', label: 'Exceptions' },
] as const

export type ManageTab = (typeof TABS)[number]['key']

export function ManageNav({ current }: { current: ManageTab }) {
  return (
    <nav className="flex gap-2 overflow-x-auto">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === current ? 'page' : undefined}
          className="rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap shadow-sm"
          style={
            tab.key === current
              ? { background: 'var(--wfr-accent)', color: 'white' }
              : { background: 'white' }
          }
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}
