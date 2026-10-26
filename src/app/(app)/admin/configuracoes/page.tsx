import type { Metadata } from "next";
import { getEnv } from "@/server/env";
import { getSettings, SETTING_LABELS } from "@/server/settings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { formatBytes } from "@/lib/utils";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Configurações · Admin" };

export default async function AdminSettings() {
  const settings = await getSettings();
  const env = getEnv();
  return (
    <>
      <PageHeader title="Configurações operacionais" description="Alterações valem imediatamente e ficam registradas na auditoria." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="py-6"><SettingsForm settings={settings} labels={SETTING_LABELS} /></CardContent>
        </Card>
        <Card className="lg:self-start">
          <CardHeader>
            <CardTitle>Definidos no servidor (.env)</CardTitle>
            <CardDescription>Exigem reinício para mudar.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-2 text-sm">
              {[
                ["Armazenamento", env.STORAGE_DRIVER],
                ["Tamanho máximo de upload", formatBytes(env.UPLOAD_MAX_BYTES)],
                ["Duração máxima do vídeo", `${Math.round(env.UPLOAD_MAX_DURATION_SECONDS / 60)} min`],
                ["Uploads por usuário/dia", env.UPLOADS_PER_DAY_PER_USER],
                ["Retenção (vídeos / cortes)", `${env.RETENTION_SOURCE_DAYS} / ${env.RETENTION_EXPORT_DAYS} dias`],
                ["Threads FFmpeg / jobs por worker", `${env.FFMPEG_THREADS} / ${env.WORKER_CONCURRENCY}`],
                ["Tempo máx. por corte", `${env.FFMPEG_TIMEOUT_SECONDS} s`],
                ["Tentativas por job", env.JOB_MAX_ATTEMPTS],
                ["E-mail", env.MAIL_DRIVER],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex justify-between gap-2"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
