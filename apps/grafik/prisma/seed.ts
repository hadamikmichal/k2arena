// Dane demonstracyjne: administrator, 3 instruktorów stałych, 3 zleceniobiorców,
// sekcje cykliczne i grafik od 4 tygodni wstecz do tygodnia do przodu.
// Uruchom: npm run db:reset
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDays, dateRange, isoWeekday, startOfWeek, todayWarsaw } from "../src/lib/time.ts";

const prisma = new PrismaClient();
const H = (h: number) => Math.round(h * 60);

// Hasła demo (tylko lokalnie!) – zmień po pierwszym logowaniu.
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "k2arena-admin";
const INSTRUCTOR_PASSWORD = process.env.SEED_INSTRUCTOR_PASSWORD ?? "k2arena-instruktor";

async function main() {
  // Seed czyści całą bazę – blokada przed przypadkowym uruchomieniem na produkcji.
  const url = process.env.DATABASE_URL ?? "";
  if (!/localhost|127\.0\.0\.1/.test(url) && process.env.SEED_FORCE !== "1") {
    throw new Error("Seed usuwa wszystkie dane. Baza nie jest lokalna – ustaw SEED_FORCE=1, jeśli na pewno chcesz.");
  }
  await prisma.sectionSession.deleteMany();
  await prisma.sectionSeries.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.user.deleteMany();

  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const instrHash = await bcrypt.hash(INSTRUCTOR_PASSWORD, 10);

  await prisma.user.create({ data: { name: "Kierownik K2", email: "admin@k2arena.pl", passwordHash: adminHash, role: "ADMIN", color: "#52514e" } });
  const mk = (name: string, email: string, employment: string, color: string) =>
    prisma.user.create({ data: { name, email, employment, color, passwordHash: instrHash } });

  const anna = await mk("Anna Nowak", "anna@k2arena.pl", "STALY", "#2a78d6");
  const bartek = await mk("Bartek Wiśniewski", "bartek@k2arena.pl", "STALY", "#eb6834");
  const kasia = await mk("Kasia Zielińska", "kasia@k2arena.pl", "STALY", "#1baf7a");
  const ola = await mk("Ola Kowalczyk", "ola@k2arena.pl", "ZLECENIE", "#6250d6");
  const piotr = await mk("Piotr Lewandowski", "piotr@k2arena.pl", "ZLECENIE", "#e87ba4");
  const michal = await mk("Michał Wójcik", "michal@k2arena.pl", "ZLECENIE", "#eda100");

  type T = [string, number, number, "OPERATOR" | "ROUTESETTING"];
  // Tygodniowy szablon zmian: [instruktor, od, do, typ]
  const template: Record<number, T[]> = {
    1: [[bartek.id, 8, 12, "ROUTESETTING"], [anna.id, 10, 16, "OPERATOR"], [bartek.id, 14, 19, "OPERATOR"], [kasia.id, 16, 22, "OPERATOR"]],
    2: [[kasia.id, 8, 12, "ROUTESETTING"], [bartek.id, 10, 16, "OPERATOR"], [kasia.id, 14, 20, "OPERATOR"], [anna.id, 16, 22, "OPERATOR"]],
    3: [[anna.id, 8, 12, "ROUTESETTING"], [kasia.id, 10, 16, "OPERATOR"], [anna.id, 15, 19, "OPERATOR"], [bartek.id, 16, 22, "OPERATOR"]],
    4: [[anna.id, 10, 16, "OPERATOR"], [kasia.id, 14, 20, "OPERATOR"], [bartek.id, 16, 22, "OPERATOR"]],
    5: [[bartek.id, 10, 16, "OPERATOR"], [anna.id, 14, 20, "OPERATOR"], [kasia.id, 16, 22, "OPERATOR"]],
    6: [[ola.id, 9, 15, "OPERATOR"], [michal.id, 12, 18, "OPERATOR"], [piotr.id, 15, 21, "OPERATOR"]],
    7: [[ola.id, 9, 15, "OPERATOR"], [piotr.id, 15, 21, "OPERATOR"]],
  };

  const today = todayWarsaw();
  const from = addDays(startOfWeek(today), -28);
  const to = addDays(startOfWeek(today), 13);
  const nextFriday = addDays(startOfWeek(today), 11);

  for (const d of dateRange(from, to)) {
    for (const [userId, s, e, type] of template[isoWeekday(d)]) {
      // Celowa luka w przyszłym piątku – pokazuje ostrzeżenia w grafiku.
      const end = d === nextFriday && userId === kasia.id ? 21 : e;
      await prisma.shift.create({ data: { userId, date: d, startMin: H(s), endMin: H(end), type } });
    }
  }

  const series: [string, string, string, number, number, number][] = [
    ["Dzieci 7–10 lat", "DZIECI", kasia.id, 1, 17, 18.5],
    ["Dorośli – początkujący", "DOROSLI", anna.id, 2, 18, 19.5],
    ["Dzieci 11–14 lat", "DZIECI", bartek.id, 3, 17, 18.5],
    ["Dzieci 7–10 lat", "DZIECI", kasia.id, 4, 17, 18.5],
    ["Dorośli – zaawansowani", "DOROSLI", anna.id, 5, 16.5, 18],
    ["Mini-sekcja weekendowa", "DZIECI", michal.id, 6, 13, 14.5],
  ];
  let first = true;
  for (const [name, kind, userId, weekday, s, e] of series) {
    const ser = await prisma.sectionSeries.create({
      data: { name, kind, userId, weekday, startMin: H(s), endMin: H(e), validFrom: from, validTo: addDays(today, 120) },
    });
    for (const d of dateRange(from, addDays(today, 120)).filter((x) => isoWeekday(x) === weekday)) {
      const status = d < today ? (first ? "CANCELLED" : "DONE") : "PLANNED";
      first = false;
      await prisma.sectionSession.create({
        data: { seriesId: ser.id, name, kind, userId, date: d, startMin: H(s), endMin: H(e), status, note: status === "CANCELLED" ? "choroba prowadzącej" : null },
      });
    }
  }
  console.log(`Seed OK. Admin: admin@k2arena.pl / ${ADMIN_PASSWORD}; instruktorzy: <imię>@k2arena.pl / ${INSTRUCTOR_PASSWORD}`);
}

main().finally(() => prisma.$disconnect());
