"use client";

import { useActionState } from "react";
import { Scissors } from "lucide-react";
import { startProcessingAction } from "@/app/actions/processing";
import { FormResult, SubmitButton } from "@/components/form";
import { credits } from "@/lib/utils";
import type { ActionResult } from "@/server/action-result";

/**
 * A chave de idempotência é gerada pelo servidor ao renderizar esta tela:
 * duplo clique ou reenvio do mesmo formulário nunca criam (nem cobram) dois processamentos.
 */
export function ConfirmForm({ projectId, expectedCredits, idempotencyKey }: { projectId: string; expectedCredits: number; idempotencyKey: string }) {
  const [state, action] = useActionState(startProcessingAction, { ok: true } as ActionResult);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="expectedCredits" value={expectedCredits} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <FormResult state={state} />
      <SubmitButton size="lg" pendingText="Iniciando..." className="h-auto w-full whitespace-normal py-3 text-center">
        <Scissors />
        Confirmar e processar ({credits(expectedCredits)})
      </SubmitButton>
    </form>
  );
}
