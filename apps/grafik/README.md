# K2 Arena – grafik instruktorów

Aplikacja do układania grafiku pracy instruktorów wspinaczkowych: dyżury operatora ściany, routesetting, sekcje dzieci/dorosłych, statystyki i integracja z Google Calendar.

## Uruchomienie lokalne

Wymaga Node 22 (`nvm use` – wersja w `.nvmrc`).

```bash
npm install
cp .env.example .env        # ustaw AUTH_SECRET (openssl rand -base64 32)
docker compose up -d        # lokalny Postgres na porcie 5433
npm run db:deploy           # tworzy tabele (migracje)
npm run db:seed             # dane demo (opcjonalnie; czyści bazę, działa tylko na lokalnej)
npm run dev                 # http://localhost:3010
```

Zmiana modelu danych: edytuj `prisma/schema.prisma`, potem `npm run db:migrate -- --name opis_zmiany` i zacommituj nowy katalog w `prisma/migrations`.

Konta demo z `prisma/seed.ts`: `admin@k2arena.pl` / `k2arena-admin`, instruktorzy `<imię>@k2arena.pl` / `k2arena-instruktor`.
Hasła demo są tylko do lokalnego testowania – na produkcji utwórz konta od zera.

## Funkcje

| Widok | Dla kogo | Co robi |
|---|---|---|
| **Grafik** | admin | Tydzień na osi czasu 8:00–22:00, klik w puste pole = nowa zmiana, klik w blok = edycja. Kopiowanie poprzedniego tygodnia. Lista naruszeń reguł i podsumowanie godzin tygodnia. |
| **Dyspozycyjność** | instruktor, admin | Instruktor zgłasza dyspozycyjność na miesiąc. Domyślnie każdy dzień to „cały dzień”, a instruktor oznacza dni niedostępne albo godziny. Admin widzi zestawienie wszystkich (kto zgłosił, kto nie) i może wpisać dyspozycyjność za instruktora. |
| **Generuj grafik** | admin | Automatyczne ułożenie dyżurów i routesettingu na miesiąc na podstawie reguł, dyspozycyjności i sekcji. Tryby: *uzupełnij luki* albo *ułóż od nowa*. Najpierw podgląd z ostrzeżeniami i godzinami na osobę, potem zapis. |
| **Sekcje** | admin | Sekcje cykliczne (dzień tygodnia, godziny, prowadzący, okres) → automatycznie generowane zajęcia. Pojedyncze zajęcia: zastępstwo, odwołanie, oznaczenie jako odbyte. Zajęcia jednorazowe. |
| **Instruktorzy** | admin | Konta, rola, typ zatrudnienia (stały / zlecenie), kolor, link iCal. |
| **Statystyki** | admin | Miesiąc lub dowolny zakres: dni pracy, godziny dyżuru / routesettingu / sekcji, liczba sekcji (odbyte / zaplanowane / odwołane), eksport CSV (Excel). |
| **Ustawienia** | admin | Edytowalne reguły + status synchronizacji Google. |
| **Mój grafik** | instruktor | Najbliższe 4 tygodnie, statystyki miesiąca, link do kalendarza, zmiana hasła. |

## Reguły grafiku (`src/lib/rules.ts`)

Domyślne wartości (edytowalne w Ustawieniach):

- Godziny otwarcia: pn–pt 10:00–22:00, sb–nd 9:00–21:00.
- W godzinach otwarcia zawsze min. 1 operator na dyżurze. **Instruktor prowadzący sekcję nie liczy się w tym czasie jako operator** – potrzebny jest drugi instruktor.
- Routesetting: pn–śr, w oknie 8:00–14:00.
- Min. 4 h pracy instruktora w dniu, w którym pracuje (dyżur + routesetting + sekcje).
- Maks. instruktorów jednocześnie: pn–śr 3, pozostałe dni 2.
- Pn–pt instruktorzy stali, sb–nd zleceniobiorcy/studenci (ostrzeżenie przy niezgodności).
- **Instruktor sekcji** (typ zatrudnienia „Instruktor sekcji”): zleceniobiorca, który prowadzi sekcje w dowolne dni, a dyżur operatora bierze tylko w weekend. Nie robi routesettingu. Gdy przychodzi tylko na sekcje, nie obowiązuje go minimum 4 h. Generator nie da mu dyżuru w dzień roboczy.
- Kolizje: ta sama osoba na dwóch zmianach naraz, sekcja w trakcie routesettingu.

Naruszenia nie blokują zapisu – pokazują się jako **błędy** (np. brak operatora) lub **ostrzeżenia** w widoku tygodnia.
Testy: `npm test`.

## Generator grafiku (`src/lib/generator.ts`)

Dla każdego dnia miesiąca:

1. **Routesetting** (dni z Ustawień, domyślnie pn–śr): jeden instruktor stały od początku okna (8:00) przez ustawioną liczbę godzin.
2. **Dyżur operatora:** algorytm bierze najwcześniejszy moment bez operatora i wybiera instruktora, który:
   - jest wtedy dostępny (dyspozycyjność),
   - nie przekroczy limitu osób naraz,
   - nie prowadzi w tym czasie sekcji (prowadzący nie liczy się jako operator).

   Preferowani są stali w dni robocze i zleceniobiorcy w weekend, osoby, które i tak są na miejscu na sekcji, oraz osoby z mniejszą liczbą godzin w miesiącu. Dyżur ma docelową długość z Ustawień (6 h); końcówka dnia krótsza niż minimum dokleja się do ostatniego dyżuru (maks. 9 h).
3. Wynik jest walidowany tymi samymi regułami co ręczny grafik; luki, których nie da się obsadzić, są pokazane w podglądzie.

**Dyspozycyjność domyślnie = dostępny cały dzień.** Instruktor oznacza tylko dni, w które nie może pracować, albo podaje godziny. Kto nie złożył zgłoszenia, jest w generatorze traktowany jako dostępny cały dzień (można to wyłączyć opcją w generatorze). Stali i tak dostają dyżury głównie pn–pt, a zleceniobiorcy w weekendy, bo to preferuje ranking kandydatów.

## Google Calendar

1. **Subskrypcja iCal (działa od razu).** Każda osoba ma prywatny link `…/api/ical/<token>` (Instruktorzy / Mój grafik). W Google Calendar: *Inne kalendarze → + → Z adresu URL*. Instruktor widzi swój grafik, administrator cały. Google odświeża subskrypcje co kilka godzin. Link można unieważnić („Wygeneruj nowy link”).
   Uwaga: Google musi mieć dostęp do aplikacji z internetu – lokalny `localhost` nie zadziała, potrzebny jest publiczny `APP_URL`.
2. **Zapis na żywo przez Google Calendar API (opcjonalnie).** Konto serwisowe Google Cloud zapisuje każdą zmianę do wspólnego kalendarza:
   - Google Cloud Console → nowy projekt → włącz *Google Calendar API* → *Konta usługi* → utwórz konto → klucz JSON.
   - Lokalnie zapisz plik jako `google-service-account.json` w katalogu aplikacji (jest w `.gitignore`) i ustaw `GOOGLE_SERVICE_ACCOUNT_FILE`. Na Vercelu wklej całą treść pliku do zmiennej `GOOGLE_SERVICE_ACCOUNT_JSON`.
   - W Google Calendar utwórz kalendarz (np. „K2 – grafik”), udostępnij go e-mailowi konta serwisowego z uprawnieniem *Wprowadzanie zmian w wydarzeniach*.
   - Ustaw `GOOGLE_CALENDAR_ID`, zrestartuj/przewdróż aplikację, w Ustawieniach kliknij *Synchronizuj* dla istniejących danych.

## Struktura

```
prisma/schema.prisma    model danych (User, Shift, SectionSeries, SectionSession, Setting)
prisma/seed.ts          dane demo
src/lib/rules.ts        silnik reguł (czyste funkcje + testy)
src/lib/calendar.ts     generator iCal
src/lib/google.ts       synchronizacja z Google Calendar API
src/lib/stats.ts        statystyki
src/app/actions.ts      akcje serwera (zapis danych)
src/app/*/              widoki
```

## Produkcja (Vercel)

- Projekt Vercel z **Root Directory = `apps/grafik`**, podłączony do repozytorium GitHub – każdy push na `main` wdraża nową wersję.
- Baza: Neon Postgres z Vercel Marketplace (ustawia `DATABASE_URL` i `DATABASE_URL_UNPOOLED`).
- Zmienne: `AUTH_SECRET`, `APP_URL` (publiczny adres, np. `https://grafik.k2arena.pl`), opcjonalnie Google.
- Build (`npm run build`) sam uruchamia migracje (`prisma migrate deploy`).
- Pierwsze konto administratora (z lokalnego komputera, ze zmiennymi produkcyjnymi):

```bash
npx vercel env pull .env.production.local
set -a && source .env.production.local && set +a && npm run admin:create -- admin@k2arena.pl "Imię Nazwisko"
```
