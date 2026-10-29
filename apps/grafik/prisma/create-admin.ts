// Tworzy (lub resetuje hasło) konto administratora – do pierwszego uruchomienia na produkcji.
// Użycie: npm run admin:create -- <email> "<Imię Nazwisko>"
// Hasło jest pobierane z ADMIN_PASSWORD albo wpisywane interaktywnie (nie trafia do historii powłoki).
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// npm gubi cudzysłowy, więc imię i nazwisko składamy z pozostałych argumentów.
const [email, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(" ") || "Administrator";
if (!email) {
  console.error('Użycie: npm run admin:create -- <email> "<Imię Nazwisko>"');
  process.exit(1);
}

let password = process.env.ADMIN_PASSWORD ?? "";
if (!password) {
  password = await readHidden("Hasło (min. 8 znaków): ");
}
if (password.length < 8) {
  console.error("Hasło musi mieć min. 8 znaków");
  process.exit(1);
}

const prisma = new PrismaClient();
const passwordHash = await bcrypt.hash(password, 10);
const user = await prisma.user.upsert({
  where: { email: email.toLowerCase() },
  create: { email: email.toLowerCase(), name, role: "ADMIN", passwordHash, color: "#52514e" },
  update: { role: "ADMIN", active: true, passwordHash },
});
console.log(`OK – administrator ${user.email}`);
await prisma.$disconnect();

/** Czyta hasło w trybie raw – wpisywane znaki nie są wyświetlane. */
function readHidden(prompt: string): Promise<string> {
  const stdin = process.stdin;
  if (!stdin.isTTY) throw new Error("Brak terminala – podaj hasło w zmiennej ADMIN_PASSWORD");
  process.stdout.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  return new Promise((resolve) => {
    let value = "";
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          return resolve(value);
        }
        if (ch === "\u0003") process.exit(130); // Ctrl-C
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else value += ch;
      }
    };
    stdin.on("data", onData);
  });
}
