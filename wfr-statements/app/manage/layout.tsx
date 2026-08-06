/** The management screens are tables, so they need a wider container than the
 *  contractor app's max-w-md. */
export default function ManageLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl px-4 pb-12">{children}</div>
}
