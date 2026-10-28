import { prisma } from "./db";
import { sanitizeRules, type Rules } from "./rules";

export async function getRules(): Promise<Rules> {
  const row = await prisma.setting.findUnique({ where: { key: "rules" } });
  return sanitizeRules(row ? JSON.parse(row.value) : null);
}

export async function saveRules(rules: Rules): Promise<void> {
  const value = JSON.stringify(rules);
  await prisma.setting.upsert({ where: { key: "rules" }, create: { key: "rules", value }, update: { value } });
}
