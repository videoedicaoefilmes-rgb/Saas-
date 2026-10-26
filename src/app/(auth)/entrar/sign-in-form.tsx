"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInAction } from "@/app/actions/auth";
import { Field, Input } from "@/components/ui/input";
import { FormResult, SubmitButton, fieldError, fieldValue } from "@/components/form";
import type { ActionResult } from "@/server/action-result";

export function SignInForm({ next }: { next: string }) {
  const [state, action] = useActionState(signInAction, { ok: true } as ActionResult);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <Field label="E-mail" htmlFor="email" error={fieldError(state, "email")}>
        <Input id="email" name="email" type="email" autoComplete="email" defaultValue={fieldValue(state, "email")} required />
      </Field>
      <Field label="Senha" htmlFor="password" error={fieldError(state, "password")}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <div className="-mt-2 text-right">
        <Link href="/recuperar-senha" className="text-sm text-primary hover:underline">Esqueci minha senha</Link>
      </div>
      <FormResult state={state} />
      <SubmitButton pendingText="Entrando..." className="w-full">Entrar</SubmitButton>
    </form>
  );
}
