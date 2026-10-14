import { NextResponse, type NextRequest } from 'next/server';
import { AUDIENCE_COOKIE, audienceRedirect, parseAudience } from './lib/audience';

/**
 * One layout tree per audience (§3.1, AC3): guests never render `/w/*` and
 * members never render `/portal/*`, so the agency's nav cannot reach a
 * guest's DOM even on a client-side bug.
 */
export function proxy(request: NextRequest) {
  const target = audienceRedirect(request.nextUrl.pathname, parseAudience(request.cookies.get(AUDIENCE_COOKIE)?.value));
  if (!target) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = target;
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/w/:path*', '/portal', '/portal/:path*'],
};
