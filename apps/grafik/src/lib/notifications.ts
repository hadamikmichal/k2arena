// Powiadomienia w aplikacji (dzwonek w nagłówku). Jedna lista dla wszystkich zalogowanych,
// „przeczytane” = starsze niż User.notificationsSeenAt danego użytkownika.
import { prisma } from "./db";
import { sendPush } from "./push";

const KEEP_DAYS = 90;

export async function notify(n: { kind: string; title: string; body: string; href: string }): Promise<void> {
  const created = await prisma.notification.create({ data: n });
  // Push na telefony (zablokowany ekran) – błąd wysyłki nie blokuje powiadomienia w aplikacji.
  await sendPush({ title: n.title, body: n.body, href: n.href, tag: created.id }).catch((err) => console.error("[push]", err));
  // Sprzątanie przy okazji – stare powiadomienia nie są potrzebne (ankiety zostają w bazie).
  await prisma.notification.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - KEEP_DAYS * 86_400_000) } } });
}

export type NotificationItem = { id: string; kind: string; title: string; body: string; href: string; createdAt: string; unread: boolean };

export async function notificationsFor(userId: string, take = 20): Promise<{ unread: number; items: NotificationItem[] }> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { notificationsSeenAt: true } });
  const seen = user?.notificationsSeenAt ?? new Date();
  const [unread, items] = await Promise.all([
    prisma.notification.count({ where: { createdAt: { gt: seen } } }),
    prisma.notification.findMany({ orderBy: { createdAt: "desc" }, take }),
  ]);
  return {
    unread,
    items: items.map((n) => ({ ...n, createdAt: n.createdAt.toISOString(), unread: n.createdAt > seen })),
  };
}
