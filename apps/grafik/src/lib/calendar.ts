// Wspólny model zdarzenia kalendarza + generator iCal (RFC 5545).
import { fmtMin } from "./time";

export type CalEvent = {
  uid: string;
  date: string;
  startMin: number;
  endMin: number;
  title: string;
  description?: string;
  updatedAt?: Date;
};

export const SHIFT_LABEL: Record<string, string> = {
  OPERATOR: "Dyżur – operator ściany",
  ROUTESETTING: "Routesetting",
};

export const KIND_LABEL: Record<string, string> = { DZIECI: "dzieci", DOROSLI: "dorośli" };

type ShiftRow = { id: string; date: string; startMin: number; endMin: number; type: string; note: string | null; updatedAt: Date; user: { name: string } };
type SessionRow = { id: string; date: string; startMin: number; endMin: number; name: string; kind: string; status: string; note: string | null; updatedAt: Date; user: { name: string } };

export function shiftEvent(s: ShiftRow, withName: boolean): CalEvent {
  const label = SHIFT_LABEL[s.type] ?? s.type;
  return {
    uid: `shift-${s.id}@grafik.k2arena.pl`,
    date: s.date,
    startMin: s.startMin,
    endMin: s.endMin,
    title: withName ? `${s.user.name} – ${label}` : `K2 Arena: ${label}`,
    description: [s.note, `Instruktor: ${s.user.name}`].filter(Boolean).join("\n"),
    updatedAt: s.updatedAt,
  };
}

export function sessionEvent(s: SessionRow, withName: boolean): CalEvent {
  const label = `Sekcja: ${s.name} (${KIND_LABEL[s.kind] ?? s.kind})`;
  const cancelled = s.status === "CANCELLED" ? "[ODWOŁANE] " : "";
  return {
    uid: `section-${s.id}@grafik.k2arena.pl`,
    date: s.date,
    startMin: s.startMin,
    endMin: s.endMin,
    title: cancelled + (withName ? `${s.user.name} – ${label}` : `K2 Arena: ${label}`),
    description: [s.note, `Prowadzący: ${s.user.name}`].filter(Boolean).join("\n"),
    updatedAt: s.updatedAt,
  };
}

/** "2026-10-26", 600 → "20261026T100000" (czas lokalny z TZID) */
function localStamp(date: string, min: number): string {
  return `${date.replaceAll("-", "")}T${fmtMin(min).replace(":", "")}00`;
}

function utcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

/** Zawija linie do 75 oktetów zgodnie z RFC 5545. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (new TextEncoder().encode(cur + ch).length > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = "";
    }
    cur += ch;
  }
  out.push(cur);
  return out.join("\r\n ");
}

const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Warsaw",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

export function buildICal(calName: string, events: CalEvent[]): string {
  const now = utcStamp(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//K2 Arena//Grafik instruktorow//PL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escape(calName)}`,
    "X-WR-TIMEZONE:Europe/Warsaw",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    ...VTIMEZONE,
  ];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${now}`,
      ...(e.updatedAt ? [`LAST-MODIFIED:${utcStamp(e.updatedAt)}`] : []),
      `DTSTART;TZID=Europe/Warsaw:${localStamp(e.date, e.startMin)}`,
      `DTEND;TZID=Europe/Warsaw:${localStamp(e.date, e.endMin)}`,
      `SUMMARY:${escape(e.title)}`,
      ...(e.description ? [`DESCRIPTION:${escape(e.description)}`] : []),
      "LOCATION:K2 Arena",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
