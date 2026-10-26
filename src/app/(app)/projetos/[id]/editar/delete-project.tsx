"use client";

import { useActionState } from "react";
import { deleteProjectAction } from "@/app/actions/projects";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormResult, SubmitButton } from "@/components/form";
import type { ActionResult } from "@/server/action-result";

export function DeleteProjectCard({ projectId }: { projectId: string }) {
  const [state, action] = useActionState(deleteProjectAction.bind(null, projectId), { ok: true } as ActionResult);
  return (
    <Card className="border-red-200">
      <CardHeader>
        <CardTitle className="text-danger">Excluir projeto</CardTitle>
        <CardDescription>Remove o vídeo, os lances e todos os arquivos gerados. Não pode ser desfeito.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          action={action}
          onSubmit={(e) => {
            if (!confirm("Excluir este projeto e todos os arquivos? Esta ação não pode ser desfeita.")) e.preventDefault();
          }}
          className="flex flex-col gap-3"
        >
          <FormResult state={state} />
          <SubmitButton variant="danger" pendingText="Excluindo..." className="self-start">Excluir projeto</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
