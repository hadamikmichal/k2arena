"use client";

import { useActionState } from "react";
import { saveRulesAction, syncGoogleAction } from "../actions";
import type { Rules } from "@/lib/rules";
import { fmtMin, WEEKDAYS, WEEKDAYS_LONG } from "@/lib/time";

export function RulesForm({ rules }: { rules: Rules }) {
  const [state, action, pending] = useActionState(saveRulesAction, null);
  return (
    <form action={action} className="space-y-5">
      <div className="overflow-x-auto">
        <table className="table min-w-[520px]">
          <thead>
            <tr><th>Dzień</th><th>Otwarcie</th><th>Zamknięcie</th><th>Maks. instruktorów naraz</th><th>Instruktorzy stali</th><th>Routesetting</th></tr>
          </thead>
          <tbody>
            {WEEKDAYS_LONG.map((d, i) => (
              <tr key={d}>
                <td>{d}</td>
                <td><input type="time" name={`open${i}_start`} defaultValue={fmtMin(rules.opening[i].startMin)} className="input w-28" /></td>
                <td><input type="time" name={`open${i}_end`} defaultValue={fmtMin(rules.opening[i].endMin)} className="input w-28" /></td>
                <td><input type="number" min={1} name={`max${i}`} defaultValue={rules.maxConcurrent[i]} className="input w-20" /></td>
                <td><input type="checkbox" name="staffDays" value={i + 1} defaultChecked={rules.staffDays.includes(i + 1)} aria-label={`Stali – ${WEEKDAYS[i]}`} /></td>
                <td><input type="checkbox" name="rsDays" value={i + 1} defaultChecked={rules.routesettingDays.includes(i + 1)} aria-label={`Routesetting – ${WEEKDAYS[i]}`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <label className="label">Routesetting od</label>
          <input type="time" name="rs_start" defaultValue={fmtMin(rules.routesettingWindow.startMin)} className="input" />
        </div>
        <div>
          <label className="label">Routesetting maks. do</label>
          <input type="time" name="rs_end" defaultValue={fmtMin(rules.routesettingWindow.endMin)} className="input" />
        </div>
        <div>
          <label className="label">Min. godzin pracy dziennie</label>
          <input type="number" step={0.5} min={0} name="minDailyHours" defaultValue={rules.minDailyMin / 60} className="input" />
        </div>
        <div>
          <label className="label">Min. operatorów na dyżurze</label>
          <input type="number" min={1} name="minOperators" defaultValue={rules.minOperators} className="input" />
        </div>
      </div>
      {state?.error && <p className="alert-error">{state.error}</p>}
      {state?.message && <p className="alert-ok">{state.message}</p>}
      <button className="btn btn-primary" disabled={pending}>{pending ? "Zapisywanie…" : "Zapisz reguły"}</button>
    </form>
  );
}

export function GoogleSyncForm({ from, to }: { from: string; to: string }) {
  const [state, action, pending] = useActionState(syncGoogleAction, null);
  return (
    <form action={action} className="space-y-2">
      <p className="text-sm text-2">Pełna synchronizacja zakresu (np. po pierwszym podłączeniu):</p>
      <div className="grid grid-cols-2 gap-2">
        <input type="date" name="from" defaultValue={from} className="input" aria-label="Od" />
        <input type="date" name="to" defaultValue={to} className="input" aria-label="Do" />
      </div>
      {state?.message && <p className="alert-ok">{state.message}</p>}
      {state?.error && <p className="alert-error">{state.error}</p>}
      <button className="btn" disabled={pending}>{pending ? "Synchronizacja…" : "Synchronizuj"}</button>
    </form>
  );
}
