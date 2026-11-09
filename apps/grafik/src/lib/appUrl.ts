// Publiczny adres aplikacji do linków (QR ankiety, iCal, powiadomienia).
// Kolejność: APP_URL (jeśli nie wskazuje na localhost) → adres, pod którym przyszło żądanie
// → domena produkcyjna z Vercela → localhost. Dzięki temu brak/błędne APP_URL nie daje linków na localhost.
import { headers } from "next/headers";

const isLocal = (url: string) => /\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(url);

export async function appUrl(): Promise<string> {
  const env = process.env.APP_URL?.replace(/\/$/, "");
  if (env && !isLocal(env)) return env;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
    const fromRequest = `${proto.split(",")[0]}://${host.split(",")[0]}`;
    if (!isLocal(fromRequest)) return fromRequest;
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return env ?? "http://localhost:3010";
}
