"use client";

import { useActionState } from "react";
import { changePasswordAction, deleteAccountAction, updateNameAction } from "@/app/actions/account";
import { Field, Input } from "@/components/ui/input";
import { FormResult, SubmitButton, fieldError } from "@/components/form";
import type { ActionResult } from "@/server/action-result";

const initial = { ok: true } as ActionResult;

export function NameForm({ name }: { name: string }) {
  const [state, action] = useActionState(updateNameAction, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label="Nome" htmlFor="name" className="flex-1">
          <Input id="name" name="name" defaultValue={name} maxLength={80} required />
        </Field>
        <SubmitButton variant="secondary" pendingText="Salvando...">Salvar</SubmitButton>
      </div>
      <FormResult state={state} />
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePasswordAction, initial);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Field label="Senha atual" htmlFor="currentPassword" error={fieldError(state, "currentPassword")}>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nova senha" htmlFor="newPassword" error={fieldError(state, "newPassword")}>
          <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" />
        </Field>
        <Field label="Confirme a nova senha" htmlFor="confirmPassword" error={fieldError(state, "confirmPassword")}>
          <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" />
        </Field>
      </div>
      <FormResult state={state} />
      <SubmitButton pendingText="Alterando..." className="self-start">Alterar senha</SubmitButton>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action] = useActionState(deleteAccountAction, initial);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Sua senha" htmlFor="del-password">
          <Input id="del-password" name="password" type="password" autoComplete="current-password" required />
        </Field>
        <Field label='Digite "EXCLUIR" para confirmar' htmlFor="confirm">
          <Input id="confirm" name="confirm" autoComplete="off" required />
        </Field>
      </div>
      <FormResult state={state} />
      <SubmitButton variant="danger" pendingText="Excluindo..." className="self-start">Excluir minha conta</SubmitButton>
    </form>
  );
}
