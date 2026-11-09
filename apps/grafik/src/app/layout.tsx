import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Source_Sans_3 } from "next/font/google";
import { getSession } from "@/lib/auth";
import { logout } from "./actions";
import { NavLinks } from "@/components/NavLinks";
import { NotificationBell } from "@/components/NotificationBell";
import "./globals.css";

const sourceSans = Source_Sans_3({ subsets: ["latin", "latin-ext"], variable: "--font-source-sans", display: "swap" });

export const metadata: Metadata = {
  title: "Grafik instruktorów – K2 Arena",
  description: "Grafik pracy instruktorów wspinaczkowych K2 Arena",
  // Aplikacja dodana do ekranu początkowego iPhone'a (warunek powiadomień push na iOS).
  appleWebApp: { capable: true, title: "K2 Grafik", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#f6b533" };

const ADMIN_NAV = [
  { href: "/grafik", label: "Grafik" },
  { href: "/sekcje", label: "Sekcje" },
  { href: "/dyspozycyjnosc", label: "Dyspozycyjność" },
  { href: "/ankiety", label: "Ankiety" },
  { href: "/instruktorzy", label: "Instruktorzy" },
  { href: "/statystyki", label: "Statystyki" },
  { href: "/ustawienia", label: "Ustawienia" },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const nav = session?.role === "ADMIN"
    ? [...ADMIN_NAV, { href: "/moj-grafik", label: "Konto" }]
    : [{ href: "/moj-grafik", label: "Mój grafik" }, { href: "/dyspozycyjnosc", label: "Dyspozycyjność" }, { href: "/ankiety", label: "Ankiety" }];
  return (
    <html lang="pl" className={sourceSans.variable}>
      <body className="min-h-screen">
        {session && (
          <header className="print:hidden sticky top-0 z-30 border-b backdrop-blur" style={{ background: "color-mix(in srgb, var(--surface) 92%, transparent)", borderColor: "var(--border)" }}>
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3">
              <Link href="/" className="flex items-center gap-3" aria-label="K2 Arena – grafik, strona główna">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/k2-arena-logo.png" alt="K2 Arena" width={120} height={25} className="brand-logo h-[25px] w-auto" />
                <span className="eyebrow border-l pl-3" style={{ borderColor: "var(--border)" }}>Grafik</span>
              </Link>
              <div className="order-last -mx-4 w-[calc(100%+2rem)] overflow-x-auto px-4 md:order-none md:mx-0 md:w-auto md:overflow-visible md:px-0">
                <NavLinks items={nav} />
              </div>
              <div className="ml-auto flex items-center gap-3 text-sm">
                <NotificationBell vapidKey={process.env.VAPID_PUBLIC_KEY} />
                <form action={logout} className="flex items-center gap-3">
                  <span className="hidden font-semibold sm:inline">{session.name}</span>
                  <button className="btn">Wyloguj</button>
                </form>
              </div>
            </div>
          </header>
        )}
        <main className="mx-auto max-w-7xl px-4 py-6 sm:py-8">{children}</main>
      </body>
    </html>
  );
}
