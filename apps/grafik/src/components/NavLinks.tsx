"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="flex gap-x-5 whitespace-nowrap md:flex-wrap">
      {items.map((n) => (
        <Link key={n.href} href={n.href} className="nav-link" aria-current={path === n.href || path.startsWith(`${n.href}/`) ? "page" : undefined}>
          {n.label}
        </Link>
      ))}
    </nav>
  );
}
