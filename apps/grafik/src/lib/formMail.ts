// PDF ankiety na e-mail recepcji (po wysłaniu formularza i ręcznie z listy ankiet).
import { prisma } from "./db";
import { loadForms } from "./formData";
import { buildFormPdf, formPdfName } from "./formPdf";
import { receptionEmails, sendMail } from "./mail";
import { FORM_STATUS_LABEL, zonesText } from "./clientForm";

const dt = (d: Date) => new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", dateStyle: "short", timeStyle: "short" }).format(d);

/** Wysyła PDF ankiety na RECEPTION_EMAIL i zapisuje emailedAt. Zwraca false, gdy e-mail nie jest skonfigurowany. */
export async function emailFormToReception(id: string): Promise<boolean> {
  const to = receptionEmails();
  if (!to.length) {
    console.warn("[mail] brak RECEPTION_EMAIL – PDF ankiety nie został wysłany");
    return false;
  }
  const [f] = await loadForms({ ids: [id] });
  if (!f) return false;
  const pdf = await buildFormPdf(f);
  const sent = await sendMail({
    to,
    subject: `Ankieta: ${f.name} – ${zonesText(f.zones)}`,
    text: [
      `Nowy formularz danych osobowych K2 Arena.`,
      ``,
      `Imię i nazwisko: ${f.name}`,
      `Data urodzenia: ${f.birthDate}`,
      `Telefon: ${f.phone}`,
      `E-mail: ${f.email}`,
      `Korzysta z: ${zonesText(f.zones)}`,
      `Status: ${FORM_STATUS_LABEL[f.status] ?? f.status}`,
      `Wypełniono: ${dt(f.createdAt)}`,
      ``,
      `Pełna kopia formularza z podpisem w załączniku (PDF).`,
    ].join("\n"),
    attachments: [{ filename: formPdfName(f), content: pdf }],
  });
  if (sent) await prisma.clientForm.update({ where: { id }, data: { emailedAt: new Date() } });
  return sent;
}
