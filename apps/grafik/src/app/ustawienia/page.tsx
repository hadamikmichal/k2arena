import { requireAdmin } from "@/lib/auth";
import { getRules } from "@/lib/settings";
import { googleConfig } from "@/lib/google";
import { addDays, startOfWeek, todayWarsaw } from "@/lib/time";
import { GoogleSyncForm, RulesForm } from "./SettingsForms";

export default async function UstawieniaPage() {
  await requireAdmin();
  const rules = await getRules();
  const google = googleConfig();
  const monday = startOfWeek(todayWarsaw());
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      <section className="card">
        <h1 className="mb-1 text-xl font-semibold">Reguły grafiku</h1>
        <p className="mb-4 text-sm muted">Grafik nie blokuje zapisu – naruszenia reguł pokazują się jako błędy/ostrzeżenia w widoku tygodnia.</p>
        <RulesForm rules={rules} />
      </section>
      <section className="card h-fit space-y-3">
        <h2 className="font-semibold">Google Calendar – synchronizacja API</h2>
        {google.enabled ? (
          <>
            <p className="alert-ok">Połączono z kalendarzem <code className="break-all">{google.calendarId}</code>. Każda zmiana w grafiku jest od razu zapisywana w Google.</p>
            <GoogleSyncForm from={monday} to={addDays(monday, 41)} />
          </>
        ) : (
          <div className="space-y-2 text-sm text-2">
            <p className="alert-warn">Nieskonfigurowane – działa tylko subskrypcja iCal (link w zakładce Instruktorzy / Konto).</p>
            <p>Aby włączyć zapis na żywo do wspólnego kalendarza Google:</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>W Google Cloud utwórz projekt, włącz <em>Google Calendar API</em> i utwórz konto serwisowe z kluczem JSON.</li>
              <li>Zapisz plik jako <code>google-service-account.json</code> w katalogu aplikacji.</li>
              <li>W Google Calendar udostępnij kalendarz e-mailowi konta serwisowego z uprawnieniem „Wprowadzanie zmian w wydarzeniach”.</li>
              <li>W pliku <code>.env</code> ustaw <code>GOOGLE_SERVICE_ACCOUNT_FILE</code> i <code>GOOGLE_CALENDAR_ID</code>, zrestartuj aplikację.</li>
            </ol>
          </div>
        )}
      </section>
    </div>
  );
}
