"use client";

import { useActionState, useEffect, useTransition } from "react";
import { deleteSession, saveSession } from "@/app/actions";
import { fmtMin } from "@/lib/time";
import type { SessionDTO, UserOpt } from "./types";

export function SessionForm({ session, defaults, users, onDone }: {
  session?: SessionDTO;
  defaults?: Partial<SessionDTO>;
  users: UserOpt[];
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(saveSession, null);
  const [deleting, startDelete] = useTransition();
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  const v = { ...defaults, ...session };
  return (
    <form action={action} className="space-y-3">
      {session && <input type="hidden" name="id" value={session.id} />}
      {session?.seriesId && (
        <p className="text-xs muted">Zajęcia z sekcji cyklicznej – zmiany dotyczą tylko tego terminu (np. zastępstwo).</p>
      )}
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <label className="label">Nazwa sekcji</label>
          <input name="name" defaultValue={v.name ?? ""} className="input" required />
        </div>
        <div>
          <label className="label">Grupa</label>
          <select name="kind" defaultValue={v.kind ?? "DZIECI"} className="input">
            <option value="DZIECI">Dzieci</option>
            <option value="DOROSLI">Dorośli</option>
          </select>
        </div>
      </div>
      <div>
        <label className="label">Prowadzący</label>
        <select name="userId" defaultValue={v.userId ?? ""} className="input" required>
          <option value="" disabled>— wybierz —</option>
          {users.filter((u) => u.active !== false || u.id === v.userId).map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="label">Data</label>
          <input type="date" name="date" defaultValue={v.date} className="input" required />
        </div>
        <div>
          <label className="label">Od</label>
          <input type="time" name="start" step={900} defaultValue={v.startMin != null ? fmtMin(v.startMin) : "17:00"} className="input" required />
        </div>
        <div>
          <label className="label">Do</label>
          <input type="time" name="end" step={900} defaultValue={v.endMin != null ? fmtMin(v.endMin) : "18:30"} className="input" required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Status</label>
          <select name="status" defaultValue={v.status ?? "PLANNED"} className="input">
            <option value="PLANNED">Zaplanowane</option>
            <option value="DONE">Odbyte</option>
            <option value="CANCELLED">Odwołane</option>
          </select>
        </div>
        <div>
          <label className="label">Notatka</label>
          <input name="note" defaultValue={v.note ?? ""} className="input" placeholder="np. zastępstwo" />
        </div>
      </div>
      {state?.error && <p className="alert-error">{state.error}</p>}
      <div className="flex justify-between gap-2 pt-1">
        {session ? (
          <button
            type="button"
            className="btn btn-danger"
            disabled={deleting}
            onClick={() => confirm("Usunąć te zajęcia? (Odwołanie zostawia ślad w statystykach)") && startDelete(async () => { await deleteSession(session.id); onDone(); })}
          >
            Usuń
          </button>
        ) : <span />}
        <button className="btn btn-primary" disabled={pending}>{pending ? "Zapisywanie…" : "Zapisz"}</button>
      </div>
    </form>
  );
}
