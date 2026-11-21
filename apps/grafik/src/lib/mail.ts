// Wysyłka e-maili przez SMTP (np. Gmail z hasłem aplikacji, skrzynka w hostingu, Brevo, Resend SMTP).
// Bez SMTP_HOST / RECEPTION_EMAIL wysyłka jest pomijana (log w konsoli) – reszta aplikacji działa normalnie.
import nodemailer from "nodemailer";

export function mailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.RECEPTION_EMAIL);
}

/** Adresy recepcji – RECEPTION_EMAIL, kilka po przecinku. */
export function receptionEmails(): string[] {
  return (process.env.RECEPTION_EMAIL ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

type Mail = { to: string[]; subject: string; text: string; attachments?: { filename: string; content: Buffer | Uint8Array }[] };

export async function sendMail(m: Mail): Promise<boolean> {
  if (!process.env.SMTP_HOST) {
    console.warn("[mail] brak SMTP_HOST – pominięto e-mail:", m.subject);
    return false;
  }
  const port = Number(process.env.SMTP_PORT || 465);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: m.to.join(", "),
    subject: m.subject,
    text: m.text,
    attachments: m.attachments?.map((a) => ({ filename: a.filename, content: Buffer.from(a.content), contentType: "application/pdf" })),
  });
  return true;
}
