import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { SESSION_COOKIE, verifySession, type SessionPayload } from "./session";

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

export async function requireUser(): Promise<SessionPayload> {
  const s = await getSession();
  if (!s) redirect("/login");
  // Rola i aktywność zawsze z bazy – dezaktywacja/zmiana roli działa od razu, bez czekania na wygaśnięcie sesji.
  const user = await prisma.user.findUnique({ where: { id: s.sub }, select: { active: true, role: true, name: true } });
  if (!user?.active) redirect("/login");
  return { ...s, role: user.role as SessionPayload["role"], name: user.name };
}

export async function requireAdmin(): Promise<SessionPayload> {
  const s = await requireUser();
  if (s.role !== "ADMIN") redirect("/moj-grafik");
  return s;
}
