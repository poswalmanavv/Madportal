import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = pathname.startsWith("/dashboard") || pathname.startsWith("/account");
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (isProtected && !token) {
    return NextResponse.redirect(new URL("/login/member", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/account/:path*"]
};
