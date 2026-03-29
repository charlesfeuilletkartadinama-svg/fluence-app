import BackButton from '@/app/components/BackButton'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BackButton />
      {children}
    </>
  )
}
