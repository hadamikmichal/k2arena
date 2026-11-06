import QRCode from "qrcode";
import { requireUser } from "@/lib/auth";
import { CopyButton } from "@/components/CopyButton";
import { PrintButton } from "./PrintButton";

// Kod QR do wydruku (recepcja, ściana) – prowadzi do publicznej ankiety /formularz.
export default async function QrPage() {
  await requireUser();
  const url = `${process.env.APP_URL ?? "http://localhost:3010"}/formularz`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#17181c", light: "#ffffff" } });
  const download = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return (
    <div className="mx-auto max-w-md space-y-4 text-center">
      <div className="flex flex-wrap justify-center gap-2 print:hidden">
        <PrintButton />
        <a className="btn" href={download} download="k2-arena-formularz-qr.svg">Pobierz SVG</a>
        <CopyButton text={url} label="Kopiuj link" />
      </div>
      <div className="card space-y-4 p-8" style={{ background: "#fff", color: "#17181c" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/k2-arena-logo.png" alt="K2 Arena" width={192} height={40} className="mx-auto h-10 w-auto" />
        <p className="text-2xl font-extrabold">Formularz danych osobowych</p>
        <p>Zeskanuj kod telefonem i wypełnij formularz przed pierwszym wejściem na ścianę.</p>
        <div className="mx-auto w-64" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="break-all text-xs">{url}</p>
      </div>
      {url.includes("localhost") && (
        <p className="alert-warn print:hidden">APP_URL wskazuje na localhost – ten kod działa tylko na tym komputerze. Na produkcji ustaw publiczny adres.</p>
      )}
    </div>
  );
}
