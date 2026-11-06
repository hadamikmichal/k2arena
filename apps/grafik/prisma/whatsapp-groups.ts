// Wypisuje grupy WhatsApp widoczne dla numeru podłączonego do Green-API – stąd bierzesz WHATSAPP_GROUP_ID.
// Użycie: set -a && source .env && set +a && npm run whatsapp:groups
// Z argumentem wysyła wiadomość testową: npm run whatsapp:groups -- test
import { greenApi, whatsappConfig } from "../src/lib/whatsapp.ts";

const contacts = (await greenApi("getContacts")) as { id: string; name: string; type: string }[];
const groups = contacts.filter((c) => c.type === "group" || c.id.endsWith("@g.us"));
if (!groups.length) console.log("Brak grup. Dodaj numer podłączony do Green-API do grupy instruktorów i spróbuj ponownie.");
for (const g of groups) console.log(`${g.id}\t${g.name}`);

if (process.argv[2] === "test") {
  const { groupId } = whatsappConfig();
  if (!groupId) throw new Error("Ustaw WHATSAPP_GROUP_ID");
  await greenApi("sendMessage", { chatId: groupId, message: "✅ Test powiadomień z aplikacji K2 Arena – grafik" });
  console.log(`Wysłano wiadomość testową do ${groupId}`);
}
