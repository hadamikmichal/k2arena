import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="mx-auto mt-12 max-w-sm sm:mt-20">
      <div className="mb-8 flex flex-col items-center gap-4 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/k2-arena-logo.png" alt="K2 Arena" width={192} height={40} className="brand-logo h-10 w-auto" />
        <div>
          <p className="eyebrow">Strefa instruktora</p>
          <h1 className="page-title mt-1">Grafik pracy</h1>
        </div>
      </div>
      <LoginForm />
    </div>
  );
}
