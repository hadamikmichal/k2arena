"use client";

import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveUser, toggleUserActive } from "../actions";
import { Modal } from "@/components/Modal";
import { CopyButton } from "@/components/CopyButton";
import { EMPLOYMENT_LABEL, EMPLOYMENT_TYPES } from "@/lib/employment";

type UserRow = { id: string; name: string; email: string; role: string; employment: string; color: string; active: boolean; icalToken: string };

const COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];

export function InstructorsView({ users, selfId, appUrl }: { users: UserRow[]; selfId: string; appUrl: string }) {
  const router = useRouter();
  const [modal, setModal] = useState<{ user?: UserRow } | null>(null);
  const [pending, start] = useTransition();
  const close = useCallback(() => {
    setModal(null);
    router.refresh();
  }, [router]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold">Instruktorzy</h1>
        <button className="btn btn-primary ml-auto" onClick={() => setModal({})}>+ Dodaj osobę</button>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="table min-w-[760px]">
          <thead>
            <tr><th>Osoba</th><th>Rola</th><th>Zatrudnienie</th><th>Kalendarz (iCal)</th><th /></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ opacity: u.active ? 1 : 0.5 }}>
                <td>
                  <div className="flex items-center gap-2 font-medium">
                    <span className="inline-block h-3 w-3 rounded-full" style={{ background: u.color }} />
                    {u.name}
                    {!u.active && <span className="badge">nieaktywny</span>}
                  </div>
                  <div className="text-xs muted">{u.email}</div>
                </td>
                <td>{u.role === "ADMIN" ? "Administrator" : "Instruktor"}</td>
                <td>{u.role === "ADMIN" ? "—" : EMPLOYMENT_LABEL[u.employment]}</td>
                <td><CopyButton text={`${appUrl}/api/ical/${u.icalToken}`} label="Kopiuj link" /></td>
                <td className="whitespace-nowrap text-right">
                  <button className="btn mr-1" onClick={() => setModal({ user: u })}>Edytuj</button>
                  {u.id !== selfId && (
                    <button className="btn" disabled={pending} onClick={() => start(async () => { await toggleUserActive(u.id); router.refresh(); })}>
                      {u.active ? "Dezaktywuj" : "Aktywuj"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm muted">
        Link iCal instruktora można dodać w Google Calendar: <em>Inne kalendarze → + → Z adresu URL</em>. Link administratora zawiera cały grafik.
      </p>
      <Modal open={modal !== null} onClose={() => setModal(null)} title={modal?.user ? "Edycja osoby" : "Nowa osoba"}>
        {modal && <UserForm user={modal.user} onDone={close} />}
      </Modal>
    </div>
  );
}

function UserForm({ user, onDone }: { user?: UserRow; onDone: () => void }) {
  const [state, action, pending] = useActionState(saveUser, null);
  const [color, setColor] = useState(user?.color ?? COLORS[0]);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  return (
    <form action={action} className="space-y-3">
      {user && <input type="hidden" name="id" value={user.id} />}
      <div>
        <label className="label">Imię i nazwisko</label>
        <input name="name" defaultValue={user?.name} className="input" required />
      </div>
      <div>
        <label className="label">E-mail (login)</label>
        <input name="email" type="email" defaultValue={user?.email} className="input" required />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Rola</label>
          <select name="role" defaultValue={user?.role ?? "INSTRUCTOR"} className="input">
            <option value="INSTRUCTOR">Instruktor</option>
            <option value="ADMIN">Administrator</option>
          </select>
        </div>
        <div>
          <label className="label">Zatrudnienie</label>
          <select name="employment" defaultValue={user?.employment ?? "STALY"} className="input">
            {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{EMPLOYMENT_LABEL[t]}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Kolor w grafiku</label>
        <input type="hidden" name="color" value={color} />
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="h-7 w-7 rounded-full"
              style={{ background: c, outline: color === c ? "2px solid var(--text)" : "none", outlineOffset: 2 }}
              aria-label={`Kolor ${c}`}
            />
          ))}
        </div>
      </div>
      <div>
        <label className="label">{user ? "Nowe hasło (zostaw puste, aby nie zmieniać)" : "Hasło startowe (min. 8 znaków)"}</label>
        <input name="password" type="password" autoComplete="new-password" className="input" minLength={user ? undefined : 8} required={!user} />
      </div>
      {state?.error && <p className="alert-error">{state.error}</p>}
      <div className="flex justify-end">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Zapisywanie…" : "Zapisz"}</button>
      </div>
    </form>
  );
}
