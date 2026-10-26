"use server";

import { redirect } from "next/navigation";
import { requireUserOrThrow } from "@/server/session";
import { startProcessing } from "@/server/services/processing";
import { formString, toActionError, type ActionResult } from "@/server/action-result";

export async function startProcessingAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  let jobId: string;
  try {
    const user = await requireUserOrThrow();
    const { job } = await startProcessing(user.id, {
      projectId: formString(form, "projectId"),
      idempotencyKey: formString(form, "idempotencyKey"),
      expectedCredits: Number(formString(form, "expectedCredits")),
    });
    jobId = job.id;
  } catch (err) {
    return toActionError(err);
  }
  redirect(`/processamentos/${jobId}`);
}
