/**
 * Promove um usuário existente a administrador.
 * Uso: pnpm admin:promote email@exemplo.com
 */
import { db } from "@/server/db";
import { audit } from "@/server/audit";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Uso: pnpm admin:promote <email>");
  process.exit(1);
}
const user = await db.user.findUnique({ where: { email } });
if (!user) {
  console.error("Usuário não encontrado. Cadastre-se primeiro pela aplicação.");
  process.exit(1);
}
await db.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
await audit({ actorUserId: null, action: "user.promoted_admin", targetType: "User", targetId: user.id, metadata: { via: "cli" } });
console.log(`✔ ${email} agora é administrador.`);
await db.$disconnect();
