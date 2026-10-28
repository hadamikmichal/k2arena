"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changePassword, resetIcalToken } from "../actions";

export function AccountForms({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState(changePassword, null);
  const [resetting, start] = useTransition();
  const router = useRouter();
  return (
    <>
      <section className="card">
        <h2 className="mb-2 font-semibold">Zmiana hasła</h2>
        <form action={action} className="space-y-2">
          <input name="current" type="password" placeholder="Obecne hasło" autoComplete="current-password" className="input" required />
          <input name="next" type="password" placeholder="Nowe hasło (min. 8 znaków)" autoComplete="new-password" minLength={8} className="input" required />
          {state?.error && <p className="alert-error">{state.error}</p>}
          {state?.message && <p className="alert-ok">{state.message}</p>}
          <button className="btn" disabled={pending}>Zmień hasło</button>
        </form>
      </section>
      <button
        className="btn w-full justify-center text-xs"
        disabled={resetting}
        onClick={() => confirm("Wygenerować nowy link do kalendarza? Stary przestanie działać.") && start(async () => { await resetIcalToken(userId); router.refresh(); })}
      >
        Wygeneruj nowy link kalendarza
      </button>
    </>
  );
}
