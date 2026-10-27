"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/server/session";
import { addAthleteMark, deleteAthleteMark, updateAthleteInfo } from "@/server/services/athlete";
import { formString, toActionError, withFields, type ActionResult } from "@/server/action-result";

export async function addAthleteMarkAction(
  projectId: string,
  input: { timeMs: number; x: number; y: number },
): Promise<ActionResult> {
  try {
    const user = await requireUserOrThrow();
    await addAthleteMark(user.id, projectId, input);
    revalidatePath(`/projetos/${projectId}`, "layout");
    return { ok: true, message: "Atleta marcado." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function deleteAthleteMarkAction(projectId: string, markId: string): Promise<ActionResult> {
  try {
    const user = await requireUserOrThrow();
    await deleteAthleteMark(user.id, markId);
    revalidatePath(`/projetos/${projectId}`, "layout");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateAthleteInfoAction(projectId: string, _prev: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await requireUserOrThrow();
    await updateAthleteInfo(user.id, projectId, {
      jerseyColor: formString(form, "jerseyColor"),
      jerseyNumber: formString(form, "jerseyNumber"),
    });
    revalidatePath(`/projetos/${projectId}`, "layout");
    return { ok: true, message: "Dados do atleta salvos." };
  } catch (err) {
    return withFields(toActionError(err), form, ["jerseyColor", "jerseyNumber"]);
  }
}
