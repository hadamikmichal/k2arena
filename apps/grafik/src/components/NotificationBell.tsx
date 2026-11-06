"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { markNotificationsSeen } from "@/app/actions";
import type { NotificationItem } from "@/lib/notifications";

const POLL_MS = 30_000;

const ago = (iso: string) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "przed chwilą";
  if (min < 60) return `${min} min temu`;
  if (min < 24 * 60) return `${Math.floor(min / 60)} godz. temu`;
  return new Date(iso).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw", dateStyle: "short", timeStyle: "short" });
};

/**
 * Dzwonek w nagłówku: licznik nieprzeczytanych, lista ostatnich powiadomień, odpytywanie serwera co 30 s.
 * Po zgodzie przeglądarki nowe powiadomienia pokazują się też jako powiadomienie systemowe (gdy aplikacja jest otwarta w karcie).
 */
export function NotificationBell() {
  const router = useRouter();
  const [data, setData] = useState<{ unread: number; items: NotificationItem[] }>({ unread: 0, items: [] });
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const known = useRef<Set<string> | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/powiadomienia", { cache: "no-store" });
      if (!res.ok) return;
      const next = (await res.json()) as { unread: number; items: NotificationItem[] };
      // Powiadomienie systemowe tylko dla nowych (nie przy pierwszym załadowaniu strony).
      if (known.current && "Notification" in window && Notification.permission === "granted") {
        for (const n of next.items.filter((i) => i.unread && !known.current!.has(i.id)).reverse()) {
          const sys = new Notification(n.title, { body: n.body, tag: n.id, icon: "/icon.png" });
          sys.onclick = () => { window.focus(); router.push(n.href); };
        }
      }
      if (known.current && next.items.some((i) => !known.current!.has(i.id))) router.refresh();
      known.current = new Set(next.items.map((i) => i.id));
      setData(next);
    } catch {
      // Brak sieci – spróbujemy przy następnym odpytaniu.
    }
  }, [router]);

  useEffect(() => {
    setPermission("Notification" in window ? Notification.permission : "unsupported");
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVisible); };
  }, [load]);

  // Licznik w tytule karty – widać go także w innej zakładce.
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\) /, "");
    document.title = data.unread ? `(${data.unread}) ${base}` : base;
  }, [data.unread]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && data.unread) {
      // Lista zostaje z wyróżnieniem do zamknięcia, licznik znika od razu.
      setData((d) => ({ ...d, unread: 0 }));
      await markNotificationsSeen();
    }
    if (!next) setData((d) => ({ ...d, items: d.items.map((i) => ({ ...i, unread: false })) }));
  };

  const enableSystem = async () => setPermission(await Notification.requestPermission());

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        className="btn relative px-2.5"
        onClick={toggle}
        aria-expanded={open}
        aria-label={data.unread ? `Powiadomienia: ${data.unread} nowych` : "Powiadomienia"}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {data.unread > 0 && (
          <span
            className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full px-1 text-center text-[11px] font-bold leading-5"
            style={{ background: "var(--err)", color: "#fff" }}
          >
            {data.unread > 99 ? "99+" : data.unread}
          </span>
        )}
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-40 mt-2 w-[min(92vw,360px)] overflow-hidden rounded-xl border"
          style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow)" }}
        >
          <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: "var(--border)" }}>
            <span className="section-title text-sm">Powiadomienia</span>
            {permission === "default" && (
              <button type="button" className="text-xs font-semibold" style={{ color: "var(--accent-text)" }} onClick={enableSystem}>
                Włącz w przeglądarce
              </button>
            )}
            {permission === "denied" && <span className="text-xs muted">zablokowane w przeglądarce</span>}
          </div>
          {data.items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm muted">Brak powiadomień.</p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto">
              {data.items.map((n) => (
                <li key={n.id} className="border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                  <Link
                    href={n.href}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-2.5 hover:bg-[var(--surface-2)]"
                    style={n.unread ? { background: "var(--accent-soft)" } : undefined}
                  >
                    <div className="text-sm font-semibold">{n.title}</div>
                    <div className="text-xs text-2">{n.body}</div>
                    <div className="mt-0.5 text-[11px] muted">{ago(n.createdAt)}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
