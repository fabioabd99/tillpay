import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// CSP with a per-request nonce, and a redirect to /sign-in for private pages
// when there's no session cookie. The redirect is only a UX shortcut, the real
// auth check is requireUser().
export const PRIVATE = ["/budgets", "/recurring", "/reports", "/settings", "/transactions"];

function isPrivate(path: string) {
  return (
    path === "/" ||
    PRIVATE.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
  );
}

function contentSecurityPolicy(nonce: string) {
  const isDev = process.env.NODE_ENV === "development";

  return [
    "default-src 'self'",
    // React needs eval in dev
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  if (isPrivate(request.nextUrl.pathname) && !getSessionCookie(request)) {
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(signIn);
  }

  const nonce = btoa(crypto.randomUUID());
  const policy = contentSecurityPolicy(nonce);

  // nonce goes on the request (for Next) and the response (for the browser)
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: [
    {
      // skip api routes, static files and metadata images
      source:
        "/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon|opengraph-image|robots.txt|sitemap.xml|manifest.webmanifest).*)",
      // skip prefetches
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
