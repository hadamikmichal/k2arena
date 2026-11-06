// Powiadomienia do grupy instruktorów na WhatsAppie przez Green-API (green-api.com).
// Green-API łączy się z numerem WhatsApp jak „połączone urządzenie” (skan QR w panelu Green-API)
// i pozwala wysyłać wiadomości do grup – oficjalne WhatsApp Business API do zwykłych grup nie pisze.
// Konfiguracja: GREEN_API_URL, GREEN_API_INSTANCE_ID, GREEN_API_TOKEN, WHATSAPP_GROUP_ID (patrz README).

export function whatsappConfig() {
  const url = (process.env.GREEN_API_URL || "https://api.green-api.com").replace(/\/$/, "");
  const instance = process.env.GREEN_API_INSTANCE_ID;
  const token = process.env.GREEN_API_TOKEN;
  const groupId = process.env.WHATSAPP_GROUP_ID;
  return { enabled: Boolean(instance && token && groupId), url, instance, token, groupId };
}

export async function greenApi(method: string, body?: unknown): Promise<unknown> {
  const { url, instance, token } = whatsappConfig();
  if (!instance || !token) throw new Error("Brak GREEN_API_INSTANCE_ID / GREEN_API_TOKEN");
  const res = await fetch(`${url}/waInstance${instance}/${method}/${token}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Green-API ${method}: ${res.status} ${await res.text()}`);
  return res.json();
}

/** Wysyła wiadomość do grupy instruktorów. Bez konfiguracji – nic nie robi. Błędy tylko loguje. */
export async function notifyInstructors(message: string): Promise<void> {
  const cfg = whatsappConfig();
  if (!cfg.enabled) return;
  try {
    await greenApi("sendMessage", { chatId: cfg.groupId, message });
  } catch (err) {
    console.error("[whatsapp] nie wysłano powiadomienia:", err);
  }
}
