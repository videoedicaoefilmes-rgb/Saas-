"use client";

import { useActionState } from "react";
import { updateSettingsAction } from "@/app/actions/admin";
import { Field, Input } from "@/components/ui/input";
import { FormResult, SubmitButton } from "@/components/form";
import type { ActionResult } from "@/server/action-result";

type Settings = Record<string, number | boolean>;

export function SettingsForm({ settings, labels }: { settings: Settings; labels: Record<string, string> }) {
  const [state, action] = useActionState(updateSettingsAction, { ok: true } as ActionResult);
  const entries = Object.entries(settings);
  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {entries.filter(([, v]) => typeof v === "number").map(([key, value]) => (
          <Field key={key} label={labels[key] ?? key} htmlFor={key}>
            <Input id={key} name={key} type="number" min={0} step={1} defaultValue={value as number} required />
          </Field>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {entries.filter(([, v]) => typeof v === "boolean").map(([key, value]) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name={key} defaultChecked={value as boolean} className="size-4 accent-[var(--primary)]" />
            {labels[key] ?? key}
          </label>
        ))}
      </div>
      <FormResult state={state} />
      <SubmitButton pendingText="Salvando..." className="self-start">Salvar configurações</SubmitButton>
    </form>
  );
}
