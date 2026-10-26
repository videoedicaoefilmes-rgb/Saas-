"use client";

import { useActionState } from "react";
import { grantTestCreditsAction } from "@/app/actions/credits";
import { FormResult, SubmitButton } from "@/components/form";
import { credits } from "@/lib/utils";
import type { ActionResult } from "@/server/action-result";

export function TestCreditsButton({ amount }: { amount: number }) {
  const [state, action] = useActionState(grantTestCreditsAction, { ok: true } as ActionResult);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormResult state={state} />
      <SubmitButton variant="secondary" pendingText="Adicionando..." className="self-start">Adicionar {credits(amount)} de teste</SubmitButton>
    </form>
  );
}
