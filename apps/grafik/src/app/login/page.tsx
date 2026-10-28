import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="mx-auto mt-16 max-w-sm">
      <div className="mb-6 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg font-bold" style={{ background: "var(--accent)", color: "var(--accent-ink)" }}>K2</span>
        <div>
          <h1 className="text-lg font-semibold">K2 Arena</h1>
          <p className="text-sm muted">Grafik instruktorów</p>
        </div>
      </div>
      <LoginForm />
    </div>
  );
}
