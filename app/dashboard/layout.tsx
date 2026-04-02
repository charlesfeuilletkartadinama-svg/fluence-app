import BackButton from '@/app/components/BackButton'

// Le redirect onboarding est géré côté client via useProfil().needsOnboarding
// dans les pages individuelles (le layout est un Server Component, pas de hooks).
// TODO: après migration 002, vérifier needsOnboarding dans dashboard/page.tsx

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BackButton />
      {children}
    </>
  )
}
