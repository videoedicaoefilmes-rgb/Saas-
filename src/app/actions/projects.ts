"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserOrThrow } from "@/server/session";
import { createProject, deleteProject, updateProject, type ProjectInput } from "@/server/services/projects";
import { formString, toActionError, withFields, type ActionResult } from "@/server/action-result";

const PROJECT_FIELDS = ["name", "athleteName", "teamName", "matchName", "matchDate", "cutMode", "paddingBeforeSeconds", "paddingAfterSeconds"];

function readProjectForm(form: FormData): ProjectInput {
  return {
    name: formString(form, "name"),
    athleteName: formString(form, "athleteName"),
    teamName: formString(form, "teamName"),
    matchName: formString(form, "matchName"),
    matchDate: formString(form, "matchDate"),
    cutMode: formString(form, "cutMode") === "FAST" ? "FAST" : "PRECISE",
    paddingBeforeSeconds: Number(formString(form, "paddingBeforeSeconds") || 0),
    paddingAfterSeconds: Number(formString(form, "paddingAfterSeconds") || 0),
  };
}

export async function createProjectAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  let id: string;
  try {
    const user = await requireUserOrThrow();
    id = (await createProject(user.id, readProjectForm(form))).id;
  } catch (err) {
    return withFields(toActionError(err), form, PROJECT_FIELDS);
  }
  redirect(`/projetos/${id}`);
}

export async function updateProjectAction(projectId: string, _prev: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await requireUserOrThrow();
    await updateProject(user.id, projectId, readProjectForm(form));
  } catch (err) {
    return withFields(toActionError(err), form, PROJECT_FIELDS);
  }
  revalidatePath(`/projetos/${projectId}`);
  redirect(`/projetos/${projectId}`);
}

export async function deleteProjectAction(projectId: string, _prev: ActionResult): Promise<ActionResult> {
  try {
    const user = await requireUserOrThrow();
    await deleteProject(user.id, projectId);
  } catch (err) {
    return toActionError(err);
  }
  redirect("/projetos?excluido=1");
}
