"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/server/session";
import { grantTestCredits } from "@/server/services/credits";
import { toActionError, type ActionResult } from "@/server/action-result";
import { credits } from "@/lib/utils";

export async function grantTestCreditsAction(_prev: ActionResult): Promise<ActionResult> {
  try {
    const user = await requireUserOrThrow();
    const { transaction } = await grantTestCredits(user.id);
    revalidatePath("/", "layout");
    return { ok: true, message: `${credits(transaction.amount)} de teste adicionados.` };
  } catch (err) {
    return toActionError(err);
  }
}
