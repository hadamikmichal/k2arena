"use client";

import { useEffect, useRef } from "react";

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(92vw,460px)] rounded-xl border p-0 backdrop:bg-black/40"
      style={{ background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
        <h2 className="font-semibold">{title}</h2>
        <button type="button" onClick={onClose} className="muted text-xl leading-none" aria-label="Zamknij">×</button>
      </div>
      <div className="p-4">{open && children}</div>
    </dialog>
  );
}
