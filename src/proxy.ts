import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const dest = new URL(
    req.nextUrl.pathname + req.nextUrl.search,
    "https://integritate.monitorul.ai",
  );
  const headers = new Headers(req.headers);
  headers.set("x-forwarded-host", req.headers.get("host") ?? "monitorul.ai");
  headers.set("x-forwarded-proto", "https");
  return NextResponse.rewrite(dest, { request: { headers } });
}

export const config = { matcher: "/integritate/:path*" };
