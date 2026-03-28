import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Vérification légère : présence du cookie de session Supabase
  // La validation JWT réelle est faite côté client dans useProfil (getUser)
  const hasCookie = request.cookies.getAll()
    .some(c => c.name.startsWith('sb-') && c.name.includes('-auth-token'))

  if (!hasCookie) {
    const loginUrl = new URL('/', request.url)
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
