import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { InstructorsView } from "./InstructorsView";

export default async function InstruktorzyPage() {
  const admin = await requireAdmin();
  const users = await prisma.user.findMany({ orderBy: [{ active: "desc" }, { role: "asc" }, { employment: "asc" }, { name: "asc" }] });
  const appUrl = process.env.APP_URL ?? "http://localhost:3010";
  return (
    <InstructorsView
      selfId={admin.sub}
      appUrl={appUrl}
      users={users.map((u) => ({
        id: u.id, name: u.name, email: u.email, role: u.role, employment: u.employment, color: u.color, active: u.active, icalToken: u.icalToken,
      }))}
    />
  );
}
