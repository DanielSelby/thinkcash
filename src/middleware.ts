import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { canAccessPage, GATEABLE_PAGES } from '@/lib/page-access'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // ── Public routes ────────────────────────────────────────
  const publicRoutes = ['/', '/features', '/pricing', '/contact']
  const isPublicRoute = publicRoutes.includes(pathname) || pathname.startsWith('/auth/')

  // Redirect unauthenticated users to login
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from auth pages
  if (user && pathname.startsWith('/auth/')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // ── Admin route protection ───────────────────────────────
  if (pathname.startsWith('/admin') && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (!profile || profile.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // ── Page access control ──────────────────────────────────
  if (user && !pathname.startsWith('/admin')) {
    // Extract the first path segment e.g. /income/add → 'income'
    const pageKey = pathname.split('/')[1]

    // Only check gateable pages (skip dashboard, profile, settings, etc.)
    const isGateable = GATEABLE_PAGES.some(p => p.key === pageKey)

    if (isGateable) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, allowed_pages, is_active')
        .eq('id', user.id)
        .single()

      // Suspended users go to login
      if (profile && !profile.is_active) {
        await supabase.auth.signOut()
        return NextResponse.redirect(new URL('/auth/login?error=suspended', request.url))
      }

      // Check page access
      if (profile && profile.role !== 'admin') {
        const allowed = canAccessPage(profile.allowed_pages, pageKey)
        if (!allowed) {
          return NextResponse.redirect(new URL('/dashboard?error=access_denied', request.url))
        }
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}