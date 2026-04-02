/* DEPRECATED — legacy page, remplacée par /dashboard/passation (sessions QCM intégrées) */
import { redirect } from 'next/navigation'

export default function SessionsPage() {
  redirect('/dashboard/passation')
}
