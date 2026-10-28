import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "./lib/session";

export async function middleware(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Publiczne: logowanie, feed iCal (chroniony tokenem w URL), zasoby statyczne.
  matcher: ["/((?!login|api/ical|_next|favicon.ico).*)"],
};
