import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Film, ListChecks, Pencil, Scissors } from "lucide-react";
import { requireUser } from "@/server/session";
import { AppError } from "@/server/errors";
import { getEnv } from "@/server/env";
import { getProjectDetail } from "@/server/services/projects";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/misc";
import { AssetStatusBadge, JobStatusBadge } from "@/components/status";
import { CLIP_CATEGORY_LABELS } from "@/lib/clips";
import { formatDuration, formatTimecode } from "@/lib/timecode";
import { formatBytes, formatDate, formatDateTime } from "@/lib/utils";
import { Uploader } from "./uploader";

export const metadata: Metadata = { title: "Projeto" };

function Step({ n, title, done, children, icon }: { n: number; title: string; done: boolean; children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-3">
        <span className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold ${done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{n}</span>
        <div className="flex flex-1 items-center gap-2">
          <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>
          <CardTitle>{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default async function ProjectPage({ params }: PageProps<"/projetos/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const project = await getProjectDetail(user.id, id).catch((e: unknown) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const { asset, clips, processingJobs } = project;
  const ready = asset?.status === "READY";
  const activeJob = processingJobs.find((j) => j.status === "QUEUED" || j.status === "RUNNING");
  const validating = asset && ["PENDING_UPLOAD", "UPLOADED", "PROBING"].includes(asset.status);
  const maxBytes = getEnv().UPLOAD_MAX_BYTES;

  const meta = [project.athleteName && `Atleta: ${project.athleteName}`, project.teamName, project.matchName, project.matchDate && formatDate(project.matchDate)].filter(Boolean);

  return (
    <>
      <PageHeader
        back={<Link href="/projetos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Projetos</Link>}
        title={project.name}
        description={meta.length ? meta.join(" · ") : "Sem informações de atleta/partida"}
        actions={<ButtonLink href={`/projetos/${id}/editar`} variant="secondary" size="sm"><Pencil />Editar</ButtonLink>}
      />

      {activeJob && (
        <Alert tone="info" className="mb-6" title="Processamento em andamento">
          <Link href={`/processamentos/${activeJob.id}`} className="font-semibold underline">Acompanhar processamento</Link>
        </Alert>
      )}

      <div className="flex flex-col gap-6">
        <Step n={1} title="Vídeo da partida" done={ready} icon={<Film />}>
          {ready && asset ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <AssetStatusBadge status={asset.status} />
                <span className="text-sm font-medium break-all">{asset.originalFilename}</span>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div><dt className="text-muted-foreground">Duração</dt><dd className="font-semibold tabular">{formatTimecode(asset.durationMs ?? 0)}</dd></div>
                <div><dt className="text-muted-foreground">Resolução</dt><dd className="font-semibold tabular">{asset.width}×{asset.height}{asset.fps ? ` · ${Math.round(asset.fps)} fps` : ""}</dd></div>
                <div><dt className="text-muted-foreground">Codecs</dt><dd className="font-semibold uppercase">{asset.videoCodec}{asset.audioCodec ? ` / ${asset.audioCodec}` : " / sem áudio"}</dd></div>
                <div><dt className="text-muted-foreground">Tamanho</dt><dd className="font-semibold tabular">{formatBytes(asset.sizeBytes)}</dd></div>
              </dl>
              {!activeJob && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-primary">Trocar vídeo</summary>
                  <div className="mt-3"><Uploader projectId={id} maxBytes={maxBytes} /></div>
                </details>
              )}
            </div>
          ) : asset?.status === "REJECTED" ? (
            <div className="flex flex-col gap-4">
              <Alert tone="error" title="Vídeo recusado">{asset.rejectionReason}</Alert>
              <Uploader projectId={id} maxBytes={maxBytes} />
            </div>
          ) : validating && asset ? (
            <Uploader projectId={id} maxBytes={maxBytes} pendingAssetId={asset.status === "PENDING_UPLOAD" ? undefined : asset.id} />
          ) : (
            <Uploader projectId={id} maxBytes={maxBytes} />
          )}
        </Step>

        <Step n={2} title="Lances" done={clips.length > 0} icon={<ListChecks />}>
          {clips.length === 0 ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-muted-foreground">Marque o início e o fim de cada lance que você quer cortar.</p>
              <ButtonLink href={`/projetos/${id}/lances`} variant={ready ? "primary" : "secondary"}>Abrir editor de lances</ButtonLink>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <ul className="divide-y divide-border rounded-lg border border-border">
                {clips.slice(0, 8).map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                    <span className="w-8 font-bold text-muted-foreground">#{c.position}</span>
                    <span className="tabular font-medium">{formatTimecode(c.startMs)} → {formatTimecode(c.endMs)}</span>
                    <span className="text-muted-foreground">{formatDuration(c.endMs - c.startMs)}</span>
                    {c.title && <span className="truncate">{c.title}</span>}
                    {c.category && <Badge tone="success">{CLIP_CATEGORY_LABELS[c.category]}</Badge>}
                  </li>
                ))}
              </ul>
              {clips.length > 8 && <p className="text-xs text-muted-foreground">+ {clips.length - 8} lance(s)</p>}
              <ButtonLink href={`/projetos/${id}/lances`} variant="secondary" className="self-start">Editar lances</ButtonLink>
            </div>
          )}
        </Step>

        <Step n={3} title="Processar e baixar" done={processingJobs.some((j) => j.status === "SUCCEEDED")} icon={<Scissors />}>
          <div className="flex flex-col gap-4">
            {activeJob ? (
              <ButtonLink href={`/processamentos/${activeJob.id}`} className="self-start">Acompanhar processamento</ButtonLink>
            ) : ready && clips.length > 0 ? (
              <ButtonLink href={`/projetos/${id}/processar`} className="self-start"><Scissors />Ver custo e processar</ButtonLink>
            ) : (
              <p className="text-sm text-muted-foreground">Disponível depois de enviar o vídeo e marcar ao menos um lance.</p>
            )}
            {processingJobs.length > 0 && (
              <div>
                <CardDescription className="mb-2">Processamentos deste projeto</CardDescription>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {processingJobs.map((j) => (
                    <li key={j.id}>
                      <Link href={`/processamentos/${j.id}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-muted/60">
                        <span>{formatDateTime(j.createdAt)} · {j.clipCount} lance(s) · {j.creditsCharged} crédito(s)</span>
                        <JobStatusBadge status={j.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Step>
      </div>
    </>
  );
}
