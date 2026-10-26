/**
 * Seed de desenvolvimento. Propositalmente NÃO cria planos com preço
 * (preços comerciais ainda não foram definidos pelo fundador).
 */
import { db } from "@/server/db";

const users = await db.user.count();
console.log(`Usuários no banco: ${users}.`);
console.log("Para criar um administrador: cadastre-se pela aplicação e rode `pnpm admin:promote seu@email`.");
await db.$disconnect();
