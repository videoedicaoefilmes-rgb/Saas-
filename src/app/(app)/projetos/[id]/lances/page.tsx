import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/server/session";
import { AppError } from "@/server/errors";
import { getProjectDetail } from "@/server/services/projects";
import { getAssetPlaybackUrl } from "@/server/services/media";
import { getSettings } from "@/server/settings";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { Alert } from "@/components/ui/alert";
import { ClipEditor } from "./clip-editor";

export const metadata: Metadata = { title: "Editor de lances" };

export default async function ClipsEditorPage({ params }: PageProps<"/projetos/[id]/lances">) {
  const user = await requireUser();
  const { id } = await params;
  const project = await getProjectDetail(user.id, id).catch((e: unknown) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const settings = await getSettings();
  const ready = project.asset?.status === "READY";
  const playbackUrl = ready ? await getAssetPlaybackUrl(user.id, project.asset!.id) : null;
  const locked = project.processingJobs.some((j) => j.status === "QUEUED" || j.status === "RUNNING");

  return (
    <>
      <PageHeader
        back={<Link href={`/projetos/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />{project.name}</Link>}
        title="Editor de lances"
        description="Digite os horários (ex.: 12:35) ou use o player para marcar início e fim no ponto exato."
        actions={
          project.clips.length > 0 && ready ? <ButtonLink href={`/projetos/${id}/processar`}>Continuar para processamento</ButtonLink> : undefined
        }
      />
      {!ready && (
        <Alert tone="warning" className="mb-6" title="Vídeo ainda não disponível">
          Você já pode anotar os lances, mas a checagem contra a duração do vídeo e a pré-visualização só funcionam depois que o vídeo for enviado e validado.
        </Alert>
      )}
      {locked && <Alert tone="info" className="mb-6">Há um processamento em andamento. Alterações nos lances valem para o próximo processamento.</Alert>}
      <ClipEditor
        projectId={id}
        playbackUrl={playbackUrl}
        durationMs={ready ? (project.asset!.durationMs ?? null) : null}
        maxClipMs={settings.maxClipDurationSeconds * 1000}
        maxClips={settings.maxClipsPerJob}
        padding={{ beforeMs: project.paddingBeforeMs, afterMs: project.paddingAfterMs }}
        clips={project.clips.map((c) => ({
          id: c.id,
          position: c.position,
          startMs: c.startMs,
          endMs: c.endMs,
          title: c.title,
          category: c.category,
          notes: c.notes,
        }))}
      />
    </>
  );
}
