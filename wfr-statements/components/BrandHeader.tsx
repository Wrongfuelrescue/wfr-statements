export function BrandHeader({ subtitle }: { subtitle?: string }) {
  return (
    <header className="flex flex-col items-center gap-2 py-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/WFR_Logo_Corrected_Transparent.png"
        alt="Wrong Fuel Rescue"
        className="h-12 w-auto"
      />
      {subtitle ? (
        <p className="text-sm font-medium" style={{ color: 'var(--wfr-text-muted)' }}>
          {subtitle}
        </p>
      ) : null}
    </header>
  )
}
