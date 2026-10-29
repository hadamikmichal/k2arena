// Tworzy (lub resetuje hasło) konto administratora – do pierwszego uruchomienia na produkcji.
// Użycie: npm run admin:create -- <email> "<Imię Nazwisko>"
// Hasło jest pobierane z ADMIN_PASSWORD albo wpisywane interaktywnie (nie trafia do historii powłoki).
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createInterface } from "node:readline/promises";

const [email, name = "Administrator"] = process.argv.slice(2);
if (!email) {
  console.error('Użycie: npm run admin:create -- <email> "<Imię Nazwisko>"');
  process.exit(1);
}

let password = process.env.ADMIN_PASSWORD ?? "";
if (!password) {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const prompt = "Hasło (min. 8 znaków): ";
  // Ukrywa wpisywane znaki – w terminalu widać tylko prompt.
  (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s) => {
    if (s.startsWith(prompt)) process.stdout.write(prompt);
  };
  password = await rl.question(prompt);
  rl.close();
  process.stdout.write("\n");
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
