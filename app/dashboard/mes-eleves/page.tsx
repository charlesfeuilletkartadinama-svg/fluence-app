/* DEPRECATED — legacy page, remplacée par /dashboard/mes-classes */
import { redirect } from 'next/navigation'

export default function MesEleves() {
  redirect('/dashboard/mes-classes')
}
