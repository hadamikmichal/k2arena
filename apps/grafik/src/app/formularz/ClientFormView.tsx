"use client";

import { startTransition, useActionState, useState } from "react";
import { submitClientForm } from "../actions";
import { CONSENT_VERSION, consentTexts, SKILL_QUESTIONS } from "@/lib/clientForm";

const TEXT = consentTexts(CONSENT_VERSION);

export function ClientFormView() {
  // Zmiana klucza = czysty formularz dla kolejnej osoby (np. tablet na recepcji).
  const [round, setRound] = useState(0);
  return <FormRound key={round} onNext={() => setRound((r) => r + 1)} />;
}

function FormRound({ onNext }: { onNext: () => void }) {
  const [state, action, pending] = useActionState(submitClientForm, null);

  if (state?.ok) {
    const verify = state.status === "WERYFIKACJA";
    return (
      <div className="card space-y-4 p-6 text-center">
        <p className="text-4xl" aria-hidden>{verify ? "🧗" : "🎓"}</p>
        <h2 className="text-xl font-bold">Dziękujemy, formularz został wysłany</h2>
        <p className="text-2">
          {verify
            ? "Zgłoś się do instruktora – sprawdzi Twoje umiejętności, zanim zaczniesz wspinać się samodzielnie."
            : "Zgłoś się do instruktora – zanim zaczniesz się wspinać, przejdziesz wprowadzenie START / szkolenie."}
        </p>
        <button type="button" className="btn mx-auto" onClick={onNext}>Wypełnij kolejny formularz</button>
      </div>
    );
  }

  return (
    // onSubmit zamiast action={…}: przy błędzie walidacji React nie czyści wpisanych pól.
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      <section className="card space-y-3 p-5">
        <div>
          <label className="label" htmlFor="name">Imię i nazwisko</label>
          <input id="name" name="name" required autoComplete="name" className="input text-base" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="birthDate">Data urodzenia</label>
            <input id="birthDate" name="birthDate" type="date" required autoComplete="bday" className="input text-base" />
          </div>
          <div>
            <label className="label" htmlFor="phone">Nr telefonu</label>
            <input id="phone" name="phone" type="tel" required autoComplete="tel" className="input text-base" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" required autoComplete="email" className="input text-base" />
        </div>
        {/* Pułapka na boty – ukryta przed ludźmi i czytnikami ekranu. */}
        <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
        <Consent name="health">{TEXT.health}</Consent>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="text-lg font-extrabold uppercase" style={{ letterSpacing: "-0.01em" }}>Strefa wspinania</h2>
        <ul className="text-2 list-disc space-y-2 pl-5 text-sm">
          {TEXT.riskItems.map((t) => <li key={t}>{t}</li>)}
        </ul>
        <Consent name="risk">{TEXT.risk}</Consent>
        <div>
          <p className="label">Imiona i nazwiska osób małoletnich pod moją opieką (jeśli dotyczy)</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="minor1" aria-label="Osoba małoletnia 1" placeholder="1." className="input text-base" />
            <input name="minor2" aria-label="Osoba małoletnia 2" placeholder="2." className="input text-base" />
          </div>
        </div>
      </section>

      <section className="card space-y-3 p-5">
        {SKILL_QUESTIONS.map((q) => (
          <fieldset key={q.key} className="flex flex-wrap items-center justify-between gap-3">
            <legend className="sr-only">{q.label}</legend>
            <span aria-hidden className="font-semibold">{q.label}</span>
            <div className="flex gap-2">
              {(["TAK", "NIE"] as const).map((v) => (
                <label
                  key={v}
                  className="cursor-pointer rounded-lg border-2 px-5 py-2 text-sm font-bold has-[:checked]:border-[var(--ink)] has-[:checked]:bg-[var(--ink)] has-[:checked]:text-[var(--ink-text)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--accent)]"
                  style={{ borderColor: "var(--border)" }}
                >
                  <input type="radio" name={q.key} value={v} required className="sr-only" />
                  {v}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </section>

      <section className="card space-y-3 p-5">
        <Consent name="liability">{TEXT.liability}</Consent>
        <Consent name="rodo">{TEXT.rodo}</Consent>
      </section>

      {state?.error && <p className="alert-error" role="alert">{state.error}</p>}
      <button className="btn btn-primary w-full justify-center py-3 text-base" disabled={pending}>
        {pending ? "Wysyłanie…" : "Wyślij formularz"}
      </button>
      <p className="muted text-center text-xs">Data wypełnienia zapisuje się automatycznie. Wysłanie formularza zastępuje podpis.</p>
    </form>
  );
}

function Consent({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <label className="note flex cursor-pointer items-start gap-3">
      <input type="checkbox" name={name} required className="mt-1 h-5 w-5 shrink-0 accent-[var(--accent)]" />
      <span>{children}</span>
    </label>
  );
}
