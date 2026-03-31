import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    if (pathname.startsWith('/api/')) {
        const res = NextResponse.next()
        res.headers.set('Cache-Control', 'no-store')
        return res
    }

    return NextResponse.next()
}

export const config = {
    matcher: ['/api/:path*'],
}
