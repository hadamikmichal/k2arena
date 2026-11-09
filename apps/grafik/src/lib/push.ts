// Powiadomienia Web Push na telefony i komputery instruktorów (działają przy zamkniętej aplikacji
// i zablokowanym ekranie). Klucze VAPID: npx web-push generate-vapid-keys (patrz README).
import webpush from "web-push";
import { prisma } from "./db";

export function pushConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@k2arena.pl";
  return { enabled: Boolean(publicKey && privateKey), publicKey, privateKey, subject };
}

export type PushMessage = { title: string; body: string; href: string; tag?: string };

/** Wysyła powiadomienie na wszystkie urządzenia aktywnych użytkowników (albo jednego). Wygasłe subskrypcje usuwa. */
export async function sendPush(msg: PushMessage, userId?: string): Promise<{ sent: number; failed: number }> {
  const cfg = pushConfig();
  if (!cfg.enabled) return { sent: 0, failed: 0 };
  webpush.setVapidDetails(cfg.subject, cfg.publicKey!, cfg.privateKey!);
  const subs = await prisma.pushSubscription.findMany({ where: { user: { active: true, ...(userId ? { id: userId } : {}) } } });
  const payload = JSON.stringify(msg);
  let sent = 0;
  let failed = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        // TTL 12 h – telefon wyłączony dłużej nie dostanie starego powiadomienia; urgency high budzi zablokowany telefon.
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 12 * 3600, urgency: "high" });
        sent++;
      } catch (err) {
        failed++;
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        else console.error("[push] błąd wysyłki:", code ?? err);
      }
    }),
  );
  return { sent, failed };
}
