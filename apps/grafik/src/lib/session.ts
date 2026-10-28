// Podpisywanie i weryfikacja tokenu sesji – działa zarówno w middleware (edge), jak i w Node.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "k2_session";

export type SessionPayload = { sub: string; role: "ADMIN" | "INSTRUCTOR"; name: string };

const key = () => new TextEncoder().encode(process.env.AUTH_SECRET ?? "dev-secret-change-me-dev-secret-change-me");

export async function signSession(p: SessionPayload): Promise<string> {
  return new SignJWT(p).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("30d").sign(key());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
