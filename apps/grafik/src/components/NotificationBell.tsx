"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deletePushSubscription, markNotificationsSeen, savePushSubscription, sendTestPush } from "@/app/actions";
import type { NotificationItem } from "@/lib/notifications";

const POLL_MS = 30_000;

const ago = (iso: string) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "przed chwilą";
  if (min < 60) return `${min} min temu`;
  if (min < 24 * 60) return `${Math.floor(min / 60)} godz. temu`;
  return new Date(iso).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw", dateStyle: "short", timeStyle: "short" });
};

// Stan powiadomień push na tym urządzeniu.
//  ios-install – iPhone/iPad w Safari: push działa dopiero po „Dodaj do ekranu początkowego”
type PushState = "loading" | "unsupported" | "ios-install" | "off" | "on" | "denied" | "no-server";

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const raw = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

/**
 * Dzwonek w nagłówku: licznik nieprzeczytanych, lista ostatnich powiadomień, odpytywanie serwera co 30 s.
 * Powiadomienia push (Web Push przez service worker /sw.js) przychodzą na telefon także przy zamkniętej
 * aplikacji i zablokowanym ekranie. Bez push – powiadomienie systemowe, gdy aplikacja jest otwarta w karcie.
 */
export function NotificationBell({ vapidKey }: { vapidKey?: string }) {
  const router = useRouter();
  const [data, setData] = useState<{ unread: number; items: NotificationItem[] }>({ unread: 0, items: [] });
  const [open, setOpen] = useState(false);
  const [push, setPush] = useState<PushState>("loading");
  const [pushMsg, setPushMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pushOn = useRef(false);
  const known = useRef<Set<string> | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/powiadomienia", { cache: "no-store" });
      if (!res.ok) return;
      const next = (await res.json()) as { unread: number; items: NotificationItem[] };
      // Powiadomienie systemowe tylko dla nowych (nie przy pierwszym załadowaniu strony).
      // Przy włączonym push powiadomienie pokazuje service worker – nie dublujemy.
      if (known.current && !pushOn.current && "Notification" in window && Notification.permission === "granted") {
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
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVisible); };
  }, [load]);

  // Licznik w tytule karty – widać go także w innej zakładce.
  // Next nadpisuje <title> przy odświeżeniu/nawigacji, więc pilnujemy prefiksu obserwatorem.
  useEffect(() => {
    const apply = () => {
      const base = document.title.replace(/^\(\d+\) /, "");
      const want = data.unread ? `(${data.unread}) ${base}` : base;
      if (document.title !== want) document.title = want;
    };
    apply();
    const obs = new MutationObserver(apply);
    obs.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => obs.disconnect();
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

  // Rejestracja service workera i sprawdzenie, czy to urządzenie ma już subskrypcję.
  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!supported) {
      setPush(isIos() && !isStandalone() ? "ios-install" : "unsupported");
      return;
    }
    if (!vapidKey) {
      setPush("no-server");
      return;
    }
    (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const sub = await reg.pushManager.getSubscription();
        if (sub && Notification.permission === "granted") {
          // Odświeżamy zapis – urządzenie przypisuje się do aktualnie zalogowanej osoby.
          await savePushSubscription(sub.toJSON());
          pushOn.current = true;
          setPush("on");
        } else setPush(Notification.permission === "denied" ? "denied" : "off");
      } catch {
        setPush("unsupported");
      }
    })();
  }, [vapidKey]);

  const enablePush = async () => {
    setBusy(true);
    setPushMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setPush(perm === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription())
        ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(vapidKey!) }));
      await savePushSubscription(sub.toJSON());
      pushOn.current = true;
      setPush("on");
      setPushMsg("Włączone. Wyślij test, żeby sprawdzić.");
    } catch {
      setPushMsg("Nie udało się włączyć powiadomień na tym urządzeniu.");
    } finally {
      setBusy(false);
    }
  };

  const disablePush = async () => {
    setBusy(true);
    try {
      const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
      if (sub) {
        await deletePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      pushOn.current = false;
      setPush("off");
      setPushMsg(null);
    } finally {
      setBusy(false);
    }
  };

  const testPush = async () => {
    setBusy(true);
    const r = await sendTestPush();
    setPushMsg(r?.error ?? r?.message ?? null);
    setBusy(false);
  };

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
            {push === "on" && <span className="text-xs font-semibold" style={{ color: "var(--ok)" }}>● na tym urządzeniu</span>}
          </div>
          <PushPanel state={push} busy={busy} msg={pushMsg} onEnable={enablePush} onDisable={disablePush} onTest={testPush} />
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

function PushPanel({ state, busy, msg, onEnable, onDisable, onTest }: {
  state: PushState; busy: boolean; msg: string | null; onEnable: () => void; onDisable: () => void; onTest: () => void;
}) {
  if (state === "loading" || state === "unsupported" || state === "no-server") return null;
  const link = "text-xs font-semibold disabled:opacity-50";
  return (
    <div className="space-y-1.5 border-b px-4 py-2.5 text-xs" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
      {state === "ios-install" && (
        <p>
          <b>Powiadomienia na iPhonie:</b> w Safari stuknij <b>Udostępnij</b> (kwadrat ze strzałką) → <b>Do ekranu początkowego</b>,
          otwórz aplikację z ikony K2 i włącz powiadomienia tutaj.
        </p>
      )}
      {state === "off" && (
        <div className="flex items-center justify-between gap-2">
          <span>Powiadomienia na telefonie, także przy zablokowanym ekranie.</span>
          <button type="button" className="btn btn-primary shrink-0 px-2.5 py-1 text-xs" disabled={busy} onClick={onEnable}>Włącz</button>
        </div>
      )}
      {state === "denied" && (
        <p>Powiadomienia są zablokowane dla tej strony. Zezwól na nie w ustawieniach przeglądarki / telefonu i odśwież stronę.</p>
      )}
      {state === "on" && (
        <div className="flex items-center gap-3">
          <button type="button" className={link} style={{ color: "var(--accent-text)" }} disabled={busy} onClick={onTest}>Wyślij test</button>
          <button type="button" className={`${link} muted`} disabled={busy} onClick={onDisable}>Wyłącz na tym urządzeniu</button>
        </div>
      )}
      {msg && <p className="muted">{msg}</p>}
    </div>
  );
}
