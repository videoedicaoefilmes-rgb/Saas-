"use client";

import { useFormStatus } from "react-dom";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";
import { Alert } from "@/components/ui/alert";
import type { ActionResult } from "@/server/action-result";

export function SubmitButton({ children, pendingText, ...props }: ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending && <Spinner />}
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}

export function FormResult({ state }: { state: ActionResult<unknown> }) {
  if (!state.ok) return <Alert tone="error">{state.error}</Alert>;
  if (state.message) return <Alert tone="success">{state.message}</Alert>;
  return null;
}

export function fieldError(state: ActionResult<unknown>, key: string): string | undefined {
  return state.ok ? undefined : state.fieldErrors?.[key];
}

/** Valor para `defaultValue`: o que o usuário digitou (se o envio falhou) ou o padrão. */
export function fieldValue(state: ActionResult<unknown>, key: string, fallback = ""): string {
  return !state.ok && state.fields && key in state.fields ? state.fields[key]! : fallback;
}
