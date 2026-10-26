"use client";

import { useActionState } from "react";
import { signUpAction } from "@/app/actions/auth";
import { Field, Input } from "@/components/ui/input";
import { FormResult, SubmitButton, fieldError, fieldValue } from "@/components/form";
import type { ActionResult } from "@/server/action-result";

export function SignUpForm() {
  const [state, action] = useActionState(signUpAction, { ok: true } as ActionResult);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Field label="Nome" htmlFor="name" error={fieldError(state, "name")}>
        <Input id="name" name="name" autoComplete="name" defaultValue={fieldValue(state, "name")} required />
      </Field>
      <Field label="E-mail" htmlFor="email" error={fieldError(state, "email")}>
        <Input id="email" name="email" type="email" autoComplete="email" defaultValue={fieldValue(state, "email")} required />
      </Field>
      <Field label="Senha" htmlFor="password" hint="Mínimo de 8 caracteres." error={fieldError(state, "password")}>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Field label="Confirme a senha" htmlFor="confirmPassword" error={fieldError(state, "confirmPassword")}>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
      </Field>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="acceptTerms" className="mt-0.5 size-4 accent-[var(--primary)]" required />
        <span>
          Li e aceito os <a href="/termos" target="_blank" className="font-semibold text-primary hover:underline">Termos de Uso</a> e a{" "}
          <a href="/privacidade" target="_blank" className="font-semibold text-primary hover:underline">Política de Privacidade</a>.
        </span>
      </label>
      {fieldError(state, "acceptTerms") && <p className="-mt-2 text-xs text-danger">{fieldError(state, "acceptTerms")}</p>}
      <FormResult state={state} />
      <SubmitButton pendingText="Criando conta..." className="w-full">Criar conta</SubmitButton>
    </form>
  );
}
