import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, FileArchive } from "lucide-react";
import { requireUser } from "@/server/session";
import { AppError } from "@/server/errors";
import { getOwnedJob } from "@/server/services/processing";
import { getExportPreviewUrl } from "@/server/services/exports";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress, PageHeader } from "@/components/ui/misc";
import { buttonVariants } from "@/components/ui/button";
import { JobStatusBadge } from "@/components/status";
import { CLIP_CATEGORY_LABELS } from "@/lib/clips";
import { formatDuration, formatTimecode } from "@/lib/timecode";
import { credits, formatBytes, formatDateTime } from "@/lib/utils";
import { JobPoller } from "./job-poller";

export const metadata: Metadata = { title: "Processamento" };

export default async function JobPage({ params }: PageProps<"/processamentos/[jobId]">) {
  const user = await requireUser();
  const { jobId } = await params;
  const job = await getOwnedJob(user.id, jobId).catch((e: unknown) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const active = job.status === "QUEUED" || job.status === "RUNNING";
  const done = job.exports.filter((e) => e.status === "DONE");
  const pct = job.exports.length ? (done.length / job.exports.length) * 100 : 0;
  const previews = new Map<string, string>();
  for (const e of done) previews.set(e.id, await getExportPreviewUrl(user.id, e.id));

  return (
    <>
      <PageHeader
        back={<Link href={`/projetos/${job.project.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />{job.project.name}</Link>}
        title="Processamento"
        description={`Iniciado em ${formatDateTime(job.createdAt)} · ${job.clipCount} lance(s) · ${credits(job.creditsCharged)}`}
        actions={
          done.length > 1 ? (
            <a href={`/api/downloads/job/${job.id}`} className={buttonVariants()} download data-testid="download-zip">
              <FileArchive />Baixar todos (ZIP)
            </a>
          ) : undefined
        }
      />
      {active && <JobPoller jobId={job.id} />}

      <Card className="mb-6">
        <CardContent className="flex flex-col gap-3 py-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <JobStatusBadge status={job.status} />
              <span className="text-sm text-muted-foreground" data-testid="job-progress">
                {done.length} de {job.exports.length} lance(s) prontos
              </span>
            </div>
            {job.status === "SUCCEEDED" && job.processingMs !== null && (
              <span className="text-xs text-muted-foreground">Tempo de processamento: {formatDuration(job.processingMs)}</span>
            )}
          </div>
          <Progress value={job.status === "SUCCEEDED" ? 100 : pct} />
          {job.status === "QUEUED" && <p className="text-sm text-muted-foreground">Na fila. O processamento começa em instantes — você pode sair desta página.</p>}
          {job.status === "RUNNING" && <p className="text-sm text-muted-foreground">Cortando os lances... você pode sair desta página; o processamento continua.</p>}
          {job.status === "RUNNING" && job.errorMessage && <p className="text-xs text-amber-700">{job.errorMessage}</p>}
          {job.status === "FAILED" && (
            <Alert tone="error" title="O processamento não foi concluído">
              {job.errorMessage}
              {job.creditStatus === "REFUNDED" && <> ({credits(job.creditsCharged)} devolvido(s) ao seu saldo.)</>}
            </Alert>
          )}
          {job.status === "SUCCEEDED" && <Alert tone="success">Pronto! {credits(job.creditsCharged)} consumido(s).</Alert>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Arquivos</CardTitle>
          <CardDescription>Links de download válidos por poucos minutos; os arquivos ficam disponíveis até a data de expiração.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="exports">
            {job.exports.map((e) => (
              <li key={e.id} className="flex flex-col overflow-hidden rounded-lg border border-border">
                {previews.get(e.id) ? (
                  <video src={previews.get(e.id)} controls preload="none" playsInline className="aspect-video w-full bg-black" />
                ) : (
                  <div className="grid aspect-video place-items-center bg-muted text-sm text-muted-foreground">
                    {e.status === "FAILED" ? "Falhou" : e.status === "DELETED" ? "Expirado" : e.status === "PROCESSING" ? "Cortando..." : "Aguardando"}
                  </div>
                )}
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-mono text-xs break-all">{e.filename}</p>
                    {e.category && <Badge tone="success">{CLIP_CATEGORY_LABELS[e.category]}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatTimecode(e.startMs)} → {formatTimecode(e.endMs)}
                    {e.title ? ` · ${e.title}` : ""}
                    {e.sizeBytes ? ` · ${formatBytes(e.sizeBytes)}` : ""}
                  </p>
                  {e.status === "DONE" && (
                    <a href={`/api/downloads/export/${e.id}`} className={buttonVariants({ variant: "secondary", size: "sm", className: "mt-auto" })} data-testid="download-clip">
                      <Download />Baixar
                    </a>
                  )}
                  {e.status === "DONE" && e.expiresAt && <p className="text-[11px] text-muted-foreground">Disponível até {formatDateTime(e.expiresAt)}</p>}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
