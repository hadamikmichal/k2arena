import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { appUrl } from "@/lib/appUrl";
import { InstructorsView } from "./InstructorsView";

export default async function InstruktorzyPage() {
  const admin = await requireAdmin();
  const users = await prisma.user.findMany({ orderBy: [{ active: "desc" }, { role: "asc" }, { employment: "asc" }, { name: "asc" }] });
  const url = await appUrl();
  return (
    <InstructorsView
      selfId={admin.sub}
      appUrl={url}
      users={users.map((u) => ({
        id: u.id, name: u.name, email: u.email, role: u.role, employment: u.employment, color: u.color, active: u.active, icalToken: u.icalToken,
      }))}
    />
  );
}
