"use client";

import { useActionState } from "react";
import { updateAthleteInfoAction } from "@/app/actions/athlete";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { FormResult, SubmitButton, fieldValue } from "@/components/form";
import type { ActionResult } from "@/server/action-result";

export function AthleteInfoForm({
  projectId,
  athleteName,
  jerseyColor,
  jerseyNumber,
}: {
  projectId: string;
  athleteName: string | null;
  jerseyColor: string;
  jerseyNumber: string;
}) {
  const [state, action] = useActionState(updateAthleteInfoAction.bind(null, projectId), { ok: true } as ActionResult);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dados do atleta {athleteName ? `· ${athleteName}` : ""}</CardTitle>
        <CardDescription>Opcional, mas ajuda a reconhecer o atleta quando ele aparece pequeno ou de costas.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <Field label="Cor da camisa" htmlFor="jerseyColor" hint="Ex.: azul com faixa branca">
            <Input id="jerseyColor" name="jerseyColor" maxLength={40} defaultValue={fieldValue(state, "jerseyColor", jerseyColor)} />
          </Field>
          <Field label="Número da camisa" htmlFor="jerseyNumber">
            <Input id="jerseyNumber" name="jerseyNumber" inputMode="numeric" maxLength={3} defaultValue={fieldValue(state, "jerseyNumber", jerseyNumber)} />
          </Field>
          <FormResult state={state} />
          <SubmitButton variant="secondary" pendingText="Salvando..." className="self-start">Salvar</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
