// Miesięczna norma godzin instruktorów UoP.
import { merge, type Interval, type Rules } from "./rules.ts";

type Block = Interval & { userId: string; date: string; status?: string };

/** Czas pracy na osobę: dyżury + routesetting + sekcje (bez odwołanych), bez podwójnego liczenia nakładek. */
export function workedMinutes(blocks: Block[]): Map<string, number> {
  const byUserDay = new Map<string, Interval[]>();
  for (const b of blocks) {
    if (b.status === "CANCELLED") continue;
    const key = `${b.userId}|${b.date}`;
    const list = byUserDay.get(key) ?? [];
    list.push(b);
    byUserDay.set(key, list);
  }
  const out = new Map<string, number>();
  for (const [key, list] of byUserDay) {
    const uid = key.split("|")[0];
    out.set(uid, (out.get(uid) ?? 0) + merge(list).reduce((a, i) => a + i.endMin - i.startMin, 0));
  }
  return out;
}

export type NormStatus = { userId: string; name: string; workedMin: number; targetMin: number; missingMin: number };

/** Stan normy dla instruktorów UoP w danym miesiącu (bloki muszą obejmować cały miesiąc). */
export function normStatus(
  users: { id: string; name: string; employment: string; active?: boolean }[],
  blocks: Block[],
  rules: Rules,
): NormStatus[] {
  const worked = workedMinutes(blocks);
  return users
    .filter((u) => u.employment === "UOP" && u.active !== false)
    .map((u) => {
      const workedMin = worked.get(u.id) ?? 0;
      return { userId: u.id, name: u.name, workedMin, targetMin: rules.uopMonthlyMinMin, missingMin: Math.max(0, rules.uopMonthlyMinMin - workedMin) };
    });
}

export function normMessage(n: NormStatus): string {
  const h = (m: number) => (Number.isInteger(m / 60) ? `${m / 60}` : (m / 60).toFixed(1).replace(".", ","));
  return `${n.name} (UoP): ${h(n.workedMin)} h w miesiącu – norma ${h(n.targetMin)} h, brakuje ${h(n.missingMin)} h`;
}
