"use client";

import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteClientForm, reviewClientForm, setClientFormStatus } from "../actions";
import { Modal } from "@/components/Modal";
import { CATEGORIES, SKILL_QUESTIONS } from "@/lib/clientForm";

type FormRow = {
  id: string; name: string; phone: string; email: string; birthDate: string; age: number; minors: string[];
  answers: { knowsAutobelay: boolean; canHarness: boolean; canBelay: boolean };
  status: string; category: string | null; note: string | null; reviewedBy: string | null; reviewedAt: string | null; createdAt: string;
};

const fmt = (iso: string) => new Date(iso).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw", dateStyle: "short", timeStyle: "short" });

export function FormsView({ forms, isAdmin }: { forms: FormRow[]; isAdmin: boolean }) {
  const router = useRouter();
  const [review, setReview] = useState<FormRow | null>(null);
  const [pending, start] = useTransition();
  const close = useCallback(() => {
    setReview(null);
    router.refresh();
  }, [router]);
  const run = (fn: () => Promise<void>) => start(async () => { await fn(); router.refresh(); });

  if (!forms.length) return <p className="card muted">Brak ankiet w tej kategorii.</p>;
  return (
    <>
      <div className="card overflow-x-auto p-0">
        <table className="table min-w-[860px]">
          <thead>
            <tr><th>Klient</th><th>Kontakt</th><th>Umiejętności</th><th>Pod opieką</th><th>Wysłano</th><th /></tr>
          </thead>
          <tbody>
            {forms.map((f) => (
              <tr key={f.id}>
                <td>
                  <div className="font-semibold">{f.name}</div>
                  <div className="text-xs muted">
                    ur. {f.birthDate} ({f.age} l.) {f.age < 18 && <span className="badge badge-accent">niepełnoletni</span>}
                  </div>
                </td>
                <td className="text-xs">
                  <a href={`tel:${f.phone.replace(/\s/g, "")}`} className="block font-semibold">{f.phone}</a>
                  <a href={`mailto:${f.email}`} className="muted">{f.email}</a>
                </td>
                <td className="text-xs">
                  {SKILL_QUESTIONS.map((q) => (
                    <div key={q.key}>
                      <span className="font-bold" style={{ color: f.answers[q.key] ? "var(--ok)" : "var(--err)" }}>{f.answers[q.key] ? "TAK" : "NIE"}</span> {q.short}
                    </div>
                  ))}
                </td>
                <td className="text-xs">{f.minors.length ? f.minors.map((m) => <div key={m}>{m}</div>) : <span className="muted">—</span>}</td>
                <td className="whitespace-nowrap text-xs">
                  {fmt(f.createdAt)}
                  {f.status === "ZAKONCZONE" && (
                    <div className="mt-1">
                      <span className="badge badge-accent">Kat. {f.category?.split(",").join(" ")}</span>
                      <div className="muted">{f.reviewedBy ?? "—"}{f.reviewedAt && `, ${fmt(f.reviewedAt)}`}</div>
                      {f.note && <div className="muted max-w-48 whitespace-normal">{f.note}</div>}
                    </div>
                  )}
                </td>
                <td className="whitespace-nowrap text-right">
                  {f.status !== "ZAKONCZONE" && <button className="btn btn-primary mr-1" onClick={() => setReview(f)}>Zatwierdź</button>}
                  {f.status === "WERYFIKACJA" && (
                    <button className="btn mr-1" disabled={pending} onClick={() => run(() => setClientFormStatus(f.id, "SZKOLENIE"))}>Na szkolenie</button>
                  )}
                  {f.status === "ZAKONCZONE" && (
                    <button className="btn mr-1" disabled={pending} onClick={() => run(() => setClientFormStatus(f.id, "WERYFIKACJA"))}>Cofnij</button>
                  )}
                  {isAdmin && (
                    <button
                      className="btn btn-danger"
                      disabled={pending}
                      onClick={() => confirm(`Usunąć ankietę: ${f.name}?`) && run(() => deleteClientForm(f.id))}
                    >
                      Usuń
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={review !== null} onClose={() => setReview(null)} title={`Zatwierdzenie: ${review?.name ?? ""}`}>
        {review && <ReviewForm form={review} onDone={close} />}
      </Modal>
    </>
  );
}

function ReviewForm({ form, onDone }: { form: FormRow; onDone: () => void }) {
  const [state, action, pending] = useActionState(reviewClientForm, null);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={form.id} />
      <p className="text-sm text-2">
        Klient odbył wprowadzenie START / szkolenie ABC / szkolenie PRO, zademonstrował wystarczające umiejętności, aby wspinać się
        bez opieki instruktora K2 Arena, i otrzymuje kategorię:
      </p>
      <div className="space-y-1.5">
        {CATEGORIES.map((c) => (
          <label key={c.code} className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" name="category" value={c.code} className="h-4 w-4 accent-[var(--accent)]" />
            {c.label}
          </label>
        ))}
      </div>
      <div>
        <label className="label" htmlFor="note">Uwagi (opcjonalnie)</label>
        <input id="note" name="note" className="input" />
      </div>
      {state?.error && <p className="alert-error">{state.error}</p>}
      <button className="btn btn-primary w-full justify-center" disabled={pending}>{pending ? "Zapisywanie…" : "Zatwierdź jako instruktor"}</button>
    </form>
  );
}
