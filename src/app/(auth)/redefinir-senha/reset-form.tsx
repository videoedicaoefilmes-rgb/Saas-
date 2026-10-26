"use client";

import { useActionState } from "react";
import { resetPasswordAction } from "@/app/actions/auth";
import { Field, Input } from "@/components/ui/input";
import { FormResult, SubmitButton, fieldError } from "@/components/form";
import type { ActionResult } from "@/server/action-result";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, { ok: true } as ActionResult);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="token" value={token} />
      <Field label="Nova senha" htmlFor="password" hint="Mínimo de 8 caracteres." error={fieldError(state, "password")}>
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Field label="Confirme a nova senha" htmlFor="confirmPassword" error={fieldError(state, "confirmPassword")}>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
      </Field>
      <FormResult state={state} />
      <SubmitButton pendingText="Salvando..." className="w-full">Salvar nova senha</SubmitButton>
    </form>
  );
}
