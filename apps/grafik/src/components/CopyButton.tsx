"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Kopiuj" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn"
      title={text}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "✓ Skopiowano" : label}
    </button>
  );
}
