"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Pole podpisu palcem / rysikiem / myszą. Podpis trafia do ukrytego pola `name` jako PNG (data URL);
 * puste pole = brak podpisu.
 */
export function SignaturePad({ name, onChange }: { name: string; onChange?: (signed: boolean) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [signed, setSigned] = useState(false);

  // Rozdzielczość płótna = rozmiar na ekranie × gęstość pikseli (ostre linie na telefonie).
  useEffect(() => {
    const canvas = canvasRef.current!;
    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { width, height } = canvas.getBoundingClientRect();
      if (canvas.width === Math.round(width * dpr)) return;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      const ctx = canvas.getContext("2d")!;
      ctx.scale(dpr, dpr);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "#111";
      // Zmiana rozmiaru czyści płótno – podpis trzeba złożyć ponownie.
      if (inputRef.current) inputRef.current.value = "";
      setSigned(false);
      onChange?.(false);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [onChange]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
    // Kropka przy samym dotknięciu.
    const ctx = e.currentTarget.getContext("2d")!;
    ctx.beginPath();
    ctx.arc(last.current.x, last.current.y, 1.2, 0, Math.PI * 2);
    ctx.fillStyle = "#111";
    ctx.fill();
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return;
    const p = point(e);
    const ctx = e.currentTarget.getContext("2d")!;
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };

  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    inputRef.current!.value = canvasRef.current!.toDataURL("image/png");
    if (!signed) {
      setSigned(true);
      onChange?.(true);
    }
  };

  const clear = () => {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    inputRef.current!.value = "";
    setSigned(false);
    onChange?.(false);
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <canvas
          ref={canvasRef}
          aria-label="Pole podpisu – podpisz się palcem"
          className="block h-44 w-full cursor-crosshair rounded-lg border-2 border-dashed"
          style={{ touchAction: "none", background: "#fff", borderColor: "var(--border)" }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerLeave={up}
        />
        {!signed && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm" style={{ color: "#8a8d85" }}>
            Podpisz się tutaj palcem
          </span>
        )}
        <span className="pointer-events-none absolute bottom-8 left-4 right-4 border-b" style={{ borderColor: "#c9c7c0" }} />
      </div>
      <div className="flex justify-end">
        <button type="button" className="btn" onClick={clear} disabled={!signed}>Wyczyść podpis</button>
      </div>
      <input ref={inputRef} type="hidden" name={name} />
    </div>
  );
}
