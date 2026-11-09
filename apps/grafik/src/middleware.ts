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
  // Publiczne: logowanie, ankieta klienta (/formularz), feed iCal (chroniony tokenem w URL), zasoby statyczne, service worker i manifest PWA.
  matcher: ["/((?!login|formularz|api/ical|_next|favicon.ico|icon.png|apple-icon.png|icons/|sw.js|manifest.webmanifest|k2-arena-logo.png).*)"],
};
