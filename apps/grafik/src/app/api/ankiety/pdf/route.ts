import { requireUser } from "@/lib/auth";
import { loadForms } from "@/lib/formData";
import { buildFormPdf, formPdfName } from "@/lib/formPdf";

// PDF jednej ankiety (ta sama treść, która idzie mailem do recepcji). ?id=…
export async function GET(req: Request) {
  await requireUser();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return new Response("Brak id", { status: 400 });
  const [f] = await loadForms({ ids: [id] });
  if (!f) return new Response("Nie znaleziono", { status: 404 });
  const pdf = await buildFormPdf(f);
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${formPdfName(f)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
