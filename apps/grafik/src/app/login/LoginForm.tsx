"use client";

import { useActionState } from "react";
import { login } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="card space-y-3">
      <div>
        <label className="label" htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" required autoComplete="username" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">Hasło</label>
        <input id="password" name="password" type="password" required autoComplete="current-password" className="input" />
      </div>
      {state?.error && <p className="alert-error">{state.error}</p>}
      <button className="btn btn-primary w-full justify-center" disabled={pending}>
        {pending ? "Logowanie…" : "Zaloguj"}
      </button>
    </form>
  );
}
