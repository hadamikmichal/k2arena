// Synchronizacja z Google Calendar przez konto serwisowe (bez biblioteki googleapis).
// Konfiguracja: GOOGLE_SERVICE_ACCOUNT_FILE + GOOGLE_CALENDAR_ID (patrz README).
// Kalendarz trzeba udostępnić adresowi e-mail konta serwisowego z prawem
// „Wprowadzanie zmian w wydarzeniach”.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { SignJWT, importPKCS8 } from "jose";
import { prisma } from "./db";
import { fmtMin } from "./time";
import { sessionEvent, shiftEvent, type CalEvent } from "./calendar";

type ServiceAccount = { client_email: string; private_key: string };

let cachedToken: { value: string; expires: number } | null = null;

export function googleConfig() {
  // GOOGLE_SERVICE_ACCOUNT_JSON (treść klucza) – na Vercelu; GOOGLE_SERVICE_ACCOUNT_FILE – lokalnie.
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const file = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  return { enabled: Boolean((json || file) && calendarId), json, file, calendarId };
}

async function loadAccount(): Promise<ServiceAccount> {
  const { json, file } = googleConfig();
  if (json) return JSON.parse(json);
  return JSON.parse(await readFile(path.resolve(process.cwd(), file!), "utf8"));
}

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) return cachedToken.value;
  const sa = await loadAccount();
  const key = await importPKCS8(sa.private_key, "RS256");
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/calendar" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(sa.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!res.ok) throw new Error(`Google OAuth: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, expires: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

async function api(method: string, suffix: string, body?: unknown): Promise<Response> {
  const { calendarId } = googleConfig();
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId!)}/events${suffix}`;
  return fetch(url, {
    method,
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function toGoogle(e: CalEvent, colorId?: string) {
  const dt = (min: number) => ({ dateTime: `${e.date}T${fmtMin(min)}:00`, timeZone: "Europe/Warsaw" });
  return {
    summary: e.title,
    description: e.description,
    location: "K2 Arena",
    start: dt(e.startMin),
    end: dt(e.endMin),
    colorId,
    extendedProperties: { private: { k2uid: e.uid } },
  };
}

/** Tworzy lub aktualizuje wydarzenie; zwraca ID wydarzenia w Google. */
async function upsertEvent(e: CalEvent, existingId: string | null, colorId?: string): Promise<string> {
  if (existingId) {
    const res = await api("PUT", `/${existingId}`, toGoogle(e, colorId));
    if (res.ok) return existingId;
    if (res.status !== 404 && res.status !== 410) throw new Error(`Google PUT: ${res.status} ${await res.text()}`);
  }
  const res = await api("POST", "", toGoogle(e, colorId));
  if (!res.ok) throw new Error(`Google POST: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { id: string }).id;
}

export async function deleteGoogleEvent(eventId: string | null | undefined): Promise<void> {
  if (!eventId || !googleConfig().enabled) return;
  try {
    const res = await api("DELETE", `/${eventId}`);
    if (!res.ok && res.status !== 404 && res.status !== 410) console.error("Google DELETE", res.status, await res.text());
  } catch (err) {
    console.error("Google DELETE", err);
  }
}

// Kolory wydarzeń Google: 9 = niebieski (dyżur), 6 = pomarańczowy (routesetting), 2 = zielony (sekcje)
const COLOR = { OPERATOR: "9", ROUTESETTING: "6", SECTION: "2" } as const;

async function pushShift(id: string): Promise<void> {
  const s = await prisma.shift.findUnique({ where: { id }, include: { user: true } });
  if (!s) return;
  const eventId = await upsertEvent(shiftEvent(s, true), s.googleEventId, COLOR[s.type as "OPERATOR"]);
  if (eventId !== s.googleEventId) await prisma.shift.update({ where: { id }, data: { googleEventId: eventId } });
}

async function pushSession(id: string): Promise<void> {
  const s = await prisma.sectionSession.findUnique({ where: { id }, include: { user: true } });
  if (!s) return;
  const eventId = await upsertEvent(sessionEvent(s, true), s.googleEventId, COLOR.SECTION);
  if (eventId !== s.googleEventId) await prisma.sectionSession.update({ where: { id }, data: { googleEventId: eventId } });
}

/** Synchronizacja po zapisie w aplikacji – błędy Google nie blokują zapisu grafiku. */
export async function syncShift(id: string): Promise<void> {
  if (!googleConfig().enabled) return;
  await pushShift(id).catch((err) => console.error("Google sync (zmiana)", err));
}

export async function syncSession(id: string): Promise<void> {
  if (!googleConfig().enabled) return;
  await pushSession(id).catch((err) => console.error("Google sync (sekcja)", err));
}

/** Pełna synchronizacja zakresu dat – do użycia z panelu ustawień. */
export async function syncRange(from: string, to: string): Promise<{ count: number; errors: number }> {
  if (!googleConfig().enabled) throw new Error("Google Calendar nie jest skonfigurowany");
  await accessToken(); // szybki błąd, jeśli konfiguracja jest niepoprawna
  const where = { date: { gte: from, lte: to } };
  const [shifts, sessions] = await Promise.all([
    prisma.shift.findMany({ where, select: { id: true } }),
    prisma.sectionSession.findMany({ where, select: { id: true } }),
  ]);
  let errors = 0;
  const run = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (err) {
      console.error("Google sync", err);
      errors++;
    }
  };
  for (const s of shifts) await run(() => pushShift(s.id));
  for (const s of sessions) await run(() => pushSession(s.id));
  return { count: shifts.length + sessions.length, errors };
}
