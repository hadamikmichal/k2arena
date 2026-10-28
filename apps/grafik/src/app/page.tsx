import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export default async function Home() {
  const s = await requireUser();
  redirect(s.role === "ADMIN" ? "/grafik" : "/moj-grafik");
}
