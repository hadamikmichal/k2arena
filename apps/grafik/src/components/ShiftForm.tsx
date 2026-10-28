"use client";

import { useActionState, useEffect, useTransition } from "react";
import { deleteShift, saveShift } from "@/app/actions";
import { fmtMin } from "@/lib/time";
import type { ShiftDTO, UserOpt } from "./types";

export function ShiftForm({ shift, defaults, users, onDone }: {
  shift?: ShiftDTO;
  defaults?: Partial<ShiftDTO>;
  users: UserOpt[];
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(saveShift, null);
  const [deleting, startDelete] = useTransition();
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  const v = { ...defaults, ...shift };
  return (
    <form action={action} className="space-y-3">
      {shift && <input type="hidden" name="id" value={shift.id} />}
      <div>
        <label className="label">Rodzaj</label>
        <select name="type" defaultValue={v.type ?? "OPERATOR"} className="input">
          <option value="OPERATOR">Dyżur – operator ściany</option>
          <option value="ROUTESETTING">Routesetting (pn–śr, 8:00–14:00)</option>
        </select>
      </div>
      <div>
        <label className="label">Instruktor</label>
        <select name="userId" defaultValue={v.userId ?? ""} className="input" required>
          <option value="" disabled>— wybierz —</option>
          {users.filter((u) => u.active !== false || u.id === v.userId).map((u) => (
            <option key={u.id} value={u.id}>{u.name} ({u.employment === "STALY" ? "stały" : "zlecenie"})</option>
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
          <input type="time" name="start" step={900} defaultValue={v.startMin != null ? fmtMin(v.startMin) : "10:00"} className="input" required />
        </div>
        <div>
          <label className="label">Do</label>
          <input type="time" name="end" step={900} defaultValue={v.endMin != null ? fmtMin(v.endMin) : "16:00"} className="input" required />
        </div>
      </div>
      <div>
        <label className="label">Notatka</label>
        <input name="note" defaultValue={v.note ?? ""} className="input" placeholder="opcjonalnie" />
      </div>
      {state?.error && <p className="alert-error">{state.error}</p>}
      <div className="flex justify-between gap-2 pt-1">
        {shift ? (
          <button
            type="button"
            className="btn btn-danger"
            disabled={deleting}
            onClick={() => confirm("Usunąć tę zmianę?") && startDelete(async () => { await deleteShift(shift.id); onDone(); })}
          >
            Usuń
          </button>
        ) : <span />}
        <button className="btn btn-primary" disabled={pending}>{pending ? "Zapisywanie…" : "Zapisz"}</button>
      </div>
    </form>
  );
}
