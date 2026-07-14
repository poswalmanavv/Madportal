import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = pathname.startsWith("/dashboard") || pathname.startsWith("/account");

  // Over HTTPS, Auth.js writes the session cookie as `__Secure-authjs.session-token`.
  // getToken() defaults to the unprefixed `authjs.session-token`, so in production it
  // found no token, bounced every logged-in user back to /login, and looped forever.
  // This never reproduced locally because http://localhost gets the unprefixed name.
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
    secureCookie: request.nextUrl.protocol === "https:"
  });

  if (isProtected && !token) {
    return NextResponse.redirect(new URL("/login/member", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/account/:path*"]
};
