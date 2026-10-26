"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/server/session";
import { addClip, deleteClip, moveClip, sortClipsByTime, updateClip, type ClipInput } from "@/server/services/clips";
import { formString, toActionError, withFields, type ActionResult } from "@/server/action-result";

const CLIP_FIELDS = ["start", "end", "title", "category", "notes"];

function readClipForm(form: FormData): ClipInput {
  return {
    start: formString(form, "start"),
    end: formString(form, "end"),
    title: formString(form, "title"),
    category: (formString(form, "category") || null) as ClipInput["category"],
    notes: formString(form, "notes"),
  };
}

export async function addClipAction(projectId: string, _prev: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await requireUserOrThrow();
    await addClip(user.id, projectId, readClipForm(form));
    revalidatePath(`/projetos/${projectId}`, "layout");
    return { ok: true, message: "Lance adicionado." };
  } catch (err) {
    return withFields(toActionError(err), form, CLIP_FIELDS);
  }
}

export async function updateClipAction(projectId: string, clipId: string, _prev: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await requireUserOrThrow();
    await updateClip(user.id, clipId, readClipForm(form));
    revalidatePath(`/projetos/${projectId}`, "layout");
    return { ok: true, message: "Lance atualizado." };
  } catch (err) {
    return withFields(toActionError(err), form, CLIP_FIELDS);
  }
}

export async function deleteClipAction(projectId: string, clipId: string): Promise<ActionResult> {
  try {
    const user = await requireUserOrThrow();
    await deleteClip(user.id, clipId);
    revalidatePath(`/projetos/${projectId}`, "layout");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

export async function moveClipAction(projectId: string, clipId: string, direction: "up" | "down"): Promise<ActionResult> {
  try {
    const user = await requireUserOrThrow();
    await moveClip(user.id, clipId, direction === "up" ? "up" : "down");
    revalidatePath(`/projetos/${projectId}`, "layout");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

export async function sortClipsAction(projectId: string): Promise<ActionResult> {
  try {
    const user = await requireUserOrThrow();
    await sortClipsByTime(user.id, projectId);
    revalidatePath(`/projetos/${projectId}`, "layout");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}
