"use client";

import { useActionState } from "react";
import { requestPasswordResetAction } from "@/app/actions/auth";
import { Field, Input } from "@/components/ui/input";
import { FormResult, SubmitButton, fieldError, fieldValue } from "@/components/form";
import type { ActionResult } from "@/server/action-result";

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordResetAction, { ok: true } as ActionResult);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Field label="E-mail" htmlFor="email" error={fieldError(state, "email")}>
        <Input id="email" name="email" type="email" autoComplete="email" defaultValue={fieldValue(state, "email")} required />
      </Field>
      <FormResult state={state} />
      <SubmitButton pendingText="Enviando..." className="w-full">Enviar link</SubmitButton>
    </form>
  );
}
