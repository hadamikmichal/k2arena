import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { logout } from "./actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grafik instruktorów – K2 Arena",
  description: "Grafik pracy instruktorów wspinaczkowych K2 Arena",
};

const ADMIN_NAV = [
  { href: "/grafik", label: "Grafik" },
  { href: "/sekcje", label: "Sekcje" },
  { href: "/dyspozycyjnosc", label: "Dyspozycyjność" },
  { href: "/instruktorzy", label: "Instruktorzy" },
  { href: "/statystyki", label: "Statystyki" },
  { href: "/ustawienia", label: "Ustawienia" },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const nav = session?.role === "ADMIN" ? ADMIN_NAV : [{ href: "/moj-grafik", label: "Mój grafik" }, { href: "/dyspozycyjnosc", label: "Dyspozycyjność" }];
  return (
    <html lang="pl">
      <body className="min-h-screen">
        {session && (
          <header className="sticky top-0 z-30 border-b" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
              <Link href="/" className="flex items-center gap-2 font-semibold">
                <span className="grid h-7 w-7 place-items-center rounded-md text-xs font-bold" style={{ background: "var(--accent)", color: "var(--accent-ink)" }}>K2</span>
                Grafik
              </Link>
              <nav className="flex flex-wrap gap-1 text-sm">
                {nav.map((n) => (
                  <Link key={n.href} href={n.href} className="rounded-md px-2.5 py-1 hover:bg-[var(--surface-2)]">
                    {n.label}
                  </Link>
                ))}
                {session.role === "ADMIN" && (
                  <Link href="/moj-grafik" className="rounded-md px-2.5 py-1 hover:bg-[var(--surface-2)]">Konto</Link>
                )}
              </nav>
              <form action={logout} className="ml-auto flex items-center gap-3 text-sm">
                <span className="text-2">{session.name}</span>
                <button className="btn">Wyloguj</button>
              </form>
            </div>
          </header>
        )}
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
