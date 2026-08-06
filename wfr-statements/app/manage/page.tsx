import { BrandHeader } from '@/components/BrandHeader'
import { ManagerLoginForm } from './ManagerLoginForm'

export const dynamic = 'force-dynamic'

export default function ManagerLoginPage() {
  return (
    // Narrower than the surrounding management layout on purpose — a login
    // form should not be six columns wide.
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col">
      <BrandHeader subtitle="Management" />
      <ManagerLoginForm />
    </main>
  )
}
