// Wspólne elementy widoków grafiku (dzień / tydzień / miesiąc).
import type { SessionDTO, ShiftDTO, UserOpt } from "@/components/types";
import type { Interval, Issue } from "@/lib/rules";

export const DAY_START = 8 * 60;
export const DAY_END = 22 * 60;
export const HOURS = Array.from({ length: (DAY_END - DAY_START) / 60 + 1 }, (_, i) => DAY_START + i * 60);

export const TYPE_TAG: Record<string, string> = { OPERATOR: "Dyżur", ROUTESETTING: "Routesetting" };

/** Dane i akcje wspólne dla wszystkich widoków. */
export type BoardData = {
  days: string[];
  today: string;
  userById: Map<string, UserOpt>;
  shifts: ShiftDTO[];
  sessions: SessionDTO[];
  issues: Record<string, Issue[]>;
  opening: Interval[];
  onShift: (s: ShiftDTO) => void;
  onSession: (s: SessionDTO) => void;
  onNewShift: (defaults: Partial<ShiftDTO>) => void;
};

export function typeColor(kind: "shift" | "session", type?: string): string {
  if (kind === "session") return "var(--series-sec)";
  return type === "ROUTESETTING" ? "var(--series-rs)" : "var(--series-op)";
}

/** Styl bloku: tło w kolorze instruktora, lewa krawędź w kolorze rodzaju pracy, sekcje przerywaną linią. */
export function blockStyle(color: string, kind: "shift" | "session", type?: string, cancelled = false): React.CSSProperties {
  return {
    background: `color-mix(in srgb, ${color} 16%, var(--surface))`,
    border: `1px ${kind === "session" ? "dashed" : "solid"} ${color}`,
    borderLeft: `4px solid ${typeColor(kind, type)}`,
    opacity: cancelled ? 0.45 : 1,
    textDecoration: cancelled ? "line-through" : undefined,
  };
}

/** Indeks dnia tygodnia (0 = pn) do tablicy godzin otwarcia. */
export function weekdayIndex(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd === 0 ? 6 : wd - 1;
}
