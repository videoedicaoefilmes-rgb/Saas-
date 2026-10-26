"use client";

import { useActionState } from "react";
import { adminAdjustCreditsAction } from "@/app/actions/admin";
import { Field, Input, Textarea } from "@/components/ui/input";
import { FormResult, SubmitButton, fieldValue } from "@/components/form";
import type { ActionResult } from "@/server/action-result";

export function AdjustCreditsForm({ userId, idempotencyKey }: { userId: string; idempotencyKey: string }) {
  const [state, action] = useActionState(adminAdjustCreditsAction.bind(null, userId), { ok: true } as ActionResult);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <Field label="Quantidade" htmlFor="amount">
        <Input id="amount" name="amount" type="number" step={1} required placeholder="Ex.: 30 ou -10" defaultValue={fieldValue(state, "amount")} />
      </Field>
      <Field label="Justificativa" htmlFor="reason" hint="Mínimo de 10 caracteres.">
        <Textarea id="reason" name="reason" required minLength={10} maxLength={300} defaultValue={fieldValue(state, "reason")} />
      </Field>
      <FormResult state={state} />
      <SubmitButton pendingText="Registrando..." className="self-start">Registrar ajuste</SubmitButton>
    </form>
  );
}
