import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const isLoggedIn = !!token;
  const isOnAuthPage = req.nextUrl.pathname.startsWith("/auth");
  const isOnApiRoute = req.nextUrl.pathname.startsWith("/api");

  // Allow auth pages and API routes
  if (isOnAuthPage || isOnApiRoute) {
    return NextResponse.next();
  }

  // Protect all other routes
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/auth/signin", req.nextUrl));
  }

  // Admin-only routes protection
  const adminOnlyRoutes = ["/clients", "/campaigns", "/admin"];
  const isOnAdminRoute = adminOnlyRoutes.some((route) =>
    req.nextUrl.pathname.startsWith(route)
  );

  if (isOnAdminRoute && token?.role !== "ADMIN") {
    // Redirect non-admin users to dashboard
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
