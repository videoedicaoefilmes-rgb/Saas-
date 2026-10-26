import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { db } from "./db";
import { AppError } from "./errors";

/**
 * Camada de acesso (DAL): toda página, Server Action e rota que lê dados de usuário
 * passa por aqui. A checagem é feita no servidor a cada requisição — o proxy apenas
 * redireciona visitantes sem cookie, não é uma barreira de segurança.
 */

export type CurrentUser = { id: string; name: string; email: string; role: "USER" | "ADMIN" };

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  // O papel é relido do banco (fonte da verdade), não do cookie.
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true },
  });
  return user;
});

/** Para páginas: redireciona ao login se não houver sessão. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  return user;
}

/** Para páginas administrativas. Usuários comuns recebem 404 (não revela a área). */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    const { notFound } = await import("next/navigation");
    notFound();
  }
  return user;
}

/** Para Route Handlers e Server Actions: lança erro em vez de redirecionar. */
export async function requireUserOrThrow(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Sua sessão expirou. Entre novamente.");
  return user;
}

export async function requireAdminOrThrow(): Promise<CurrentUser> {
  const user = await requireUserOrThrow();
  if (user.role !== "ADMIN") throw new AppError("FORBIDDEN", "Acesso restrito.");
  return user;
}
