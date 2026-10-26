"use client";

import { useActionState } from "react";
import { Field, Input, Select } from "@/components/ui/input";
import { FormResult, SubmitButton, fieldError, fieldValue } from "@/components/form";
import type { ActionResult } from "@/server/action-result";

export type ProjectFormValues = {
  name: string;
  athleteName: string;
  teamName: string;
  matchName: string;
  matchDate: string;
  cutMode: "PRECISE" | "FAST";
  paddingBeforeSeconds: number;
  paddingAfterSeconds: number;
};

export function ProjectForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (prev: ActionResult, form: FormData) => Promise<ActionResult>;
  defaults?: Partial<ProjectFormValues>;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, { ok: true } as ActionResult);
  const base = defaults ?? {};
  const v = (key: keyof ProjectFormValues) => fieldValue(state, key, base[key] === undefined ? "" : String(base[key]));
  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <Field label="Nome do projeto *" htmlFor="name" hint="Ex.: Final Copa Verão — João" error={fieldError(state, "name")}>
        <Input id="name" name="name" defaultValue={v("name")} required maxLength={120} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Atleta" htmlFor="athleteName" hint="Usado no nome dos arquivos." error={fieldError(state, "athleteName")}>
          <Input id="athleteName" name="athleteName" defaultValue={v("athleteName")} maxLength={80} />
        </Field>
        <Field label="Equipe" htmlFor="teamName" error={fieldError(state, "teamName")}>
          <Input id="teamName" name="teamName" defaultValue={v("teamName")} maxLength={80} />
        </Field>
        <Field label="Partida" htmlFor="matchName" hint="Ex.: Final Sub-15 x Atlético" error={fieldError(state, "matchName")}>
          <Input id="matchName" name="matchName" defaultValue={v("matchName")} maxLength={120} />
        </Field>
        <Field label="Data da partida" htmlFor="matchDate" error={fieldError(state, "matchDate")}>
          <Input id="matchDate" name="matchDate" type="date" defaultValue={v("matchDate")} />
        </Field>
      </div>
      <fieldset className="grid gap-5 rounded-xl border border-border p-4 sm:grid-cols-3">
        <legend className="px-1 text-sm font-semibold">Opções de corte</legend>
        <Field label="Modo de corte" htmlFor="cutMode" hint="Preciso: corta no quadro exato (recomendado)." className="sm:col-span-1">
          <Select id="cutMode" name="cutMode" defaultValue={v("cutMode") || "PRECISE"}>
            <option value="PRECISE">Preciso (recodifica)</option>
            <option value="FAST">Rápido (sem recodificar)</option>
          </Select>
        </Field>
        <Field label="Margem antes (s)" htmlFor="paddingBeforeSeconds" hint="Segundos extras antes de cada lance." error={fieldError(state, "paddingBeforeSeconds")}>
          <Input id="paddingBeforeSeconds" name="paddingBeforeSeconds" type="number" min={0} max={30} defaultValue={v("paddingBeforeSeconds") || 0} />
        </Field>
        <Field label="Margem depois (s)" htmlFor="paddingAfterSeconds" hint="Segundos extras depois de cada lance." error={fieldError(state, "paddingAfterSeconds")}>
          <Input id="paddingAfterSeconds" name="paddingAfterSeconds" type="number" min={0} max={30} defaultValue={v("paddingAfterSeconds") || 0} />
        </Field>
        <p className="text-xs text-muted-foreground sm:col-span-3">
          O modo rápido é quase instantâneo, mas o início do corte “encaixa” no quadro-chave anterior do vídeo e pode começar alguns segundos antes do horário marcado.
        </p>
      </fieldset>
      <FormResult state={state} />
      <SubmitButton pendingText="Salvando..." className="self-start">{submitLabel}</SubmitButton>
    </form>
  );
}
