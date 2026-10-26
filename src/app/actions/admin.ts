"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOrThrow } from "@/server/session";
import { adminAdjustCredits } from "@/server/services/credits";
import { settingsSchema, updateSettings, type Settings } from "@/server/settings";
import { formString, toActionError, withFields, type ActionResult } from "@/server/action-result";
import { credits } from "@/lib/utils";

export async function adminAdjustCreditsAction(targetUserId: string, _prev: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdminOrThrow();
    const amount = Number(formString(form, "amount"));
    const result = await adminAdjustCredits({
      adminUserId: admin.id,
      targetUserId,
      amount,
      reason: formString(form, "reason"),
      idempotencyKey: formString(form, "idempotencyKey"),
    });
    revalidatePath(`/admin/usuarios/${targetUserId}`);
    return result.duplicate
      ? { ok: true, message: "Este ajuste já havia sido registrado." }
      : { ok: true, message: `Ajuste de ${credits(amount)} registrado. Novo saldo: ${result.transaction.balanceAfter}.` };
  } catch (err) {
    return withFields(toActionError(err), form, ["amount", "reason"]);
  }
}

export async function updateSettingsAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdminOrThrow();
    const shape = settingsSchema.shape;
    const patch: Record<string, unknown> = {};
    for (const key of Object.keys(shape) as (keyof Settings)[]) {
      const isBool = shape[key].type === "boolean";
      patch[key] = isBool ? form.get(key) === "on" : Number(formString(form, key));
    }
    await updateSettings(settingsSchema.parse(patch), admin.id);
    revalidatePath("/admin/configuracoes");
    return { ok: true, message: "Configurações salvas." };
  } catch (err) {
    return toActionError(err);
  }
}
