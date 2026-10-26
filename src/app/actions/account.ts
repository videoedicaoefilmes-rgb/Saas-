"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { requireUserOrThrow } from "@/server/session";
import { deleteAccount } from "@/server/services/account";
import { formString, toActionError, type ActionResult } from "@/server/action-result";

export async function updateNameAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await requireUserOrThrow();
    const name = z.string().trim().min(2, "Informe seu nome.").max(80).parse(formString(form, "name"));
    await db.user.update({ where: { id: user.id }, data: { name } });
    revalidatePath("/", "layout");
    return { ok: true, message: "Nome atualizado." };
  } catch (err) {
    return toActionError(err);
  }
}

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual."),
    newPassword: z.string().min(8, "A nova senha precisa ter pelo menos 8 caracteres.").max(128),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, { path: ["confirmPassword"], message: "As senhas não conferem." });

export async function changePasswordAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    await requireUserOrThrow();
    const input = changePasswordSchema.parse({
      currentPassword: formString(form, "currentPassword"),
      newPassword: formString(form, "newPassword"),
      confirmPassword: formString(form, "confirmPassword"),
    });
    await auth.api.changePassword({
      body: { currentPassword: input.currentPassword, newPassword: input.newPassword, revokeOtherSessions: true },
      headers: await headers(),
    });
    return { ok: true, message: "Senha alterada. Outras sessões foram encerradas." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function deleteAccountAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await requireUserOrThrow();
    if (formString(form, "confirm") !== "EXCLUIR") {
      return { ok: false, error: 'Digite EXCLUIR para confirmar.' };
    }
    await deleteAccount(user.id, formString(form, "password"));
  } catch (err) {
    return toActionError(err);
  }
  redirect("/?conta=excluida");
}
