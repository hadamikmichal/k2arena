import type { Metadata } from "next";
import { ClientFormView } from "./ClientFormView";

export const metadata: Metadata = { title: "Formularz danych osobowych – K2 Arena" };

// Publiczna ankieta dla klientów ściany (otwierana z kodu QR) – bez logowania, patrz middleware.
export default function FormularzPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex flex-col items-center gap-4 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/k2-arena-logo.png" alt="K2 Arena" width={192} height={40} className="brand-logo h-10 w-auto" />
        <div>
          <p className="eyebrow">Klub Sportowy K2 Arena</p>
          <h1 className="page-title mt-1">Formularz danych osobowych</h1>
        </div>
      </div>
      <ClientFormView />
    </div>
  );
}
