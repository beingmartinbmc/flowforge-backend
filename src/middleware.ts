import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Allowed origins configuration
const ALLOWED_ORIGINS = [
  'https://beingmartinbmc.github.io'
];

// Development origins (empty for security)
const DEV_ORIGINS: string[] = [];

function isOriginAllowed(origin: string): boolean {
  if (!origin) return false;

  // Check exact matches
  if (ALLOWED_ORIGINS.includes(origin)) {
    return true;
  }

  // Check development origins
  if (process.env.NODE_ENV === 'development') {
    return DEV_ORIGINS.some((devOrigin) => {
      const pattern = devOrigin.replace('*', '.*');
      return new RegExp(pattern).test(origin);
    });
  }

  return false;
}

export function middleware(request: NextRequest) {
  // Only apply to API routes
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const origin = request.headers.get('origin');
  const isAllowed = isOriginAllowed(origin || '');

  // Create response
  const response = NextResponse.next();

  // Set CORS headers
  response.headers.set('Access-Control-Allow-Origin', isAllowed ? origin || '' : '');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Max-Age', '86400');

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 200, headers: response.headers });
  }

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
