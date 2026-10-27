import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/server/session";
import { AppError } from "@/server/errors";
import { getProjectDetail } from "@/server/services/projects";
import { getAssetPlaybackUrl } from "@/server/services/media";
import { listAthleteMarks, MAX_MARKS_PER_VIDEO } from "@/server/services/athlete";
import { PageHeader } from "@/components/ui/misc";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { AthleteMarker } from "./athlete-marker";
import { AthleteInfoForm } from "./athlete-info-form";

export const metadata: Metadata = { title: "Identificar o atleta" };

export default async function AthletePage({ params }: PageProps<"/projetos/[id]/atleta">) {
  const user = await requireUser();
  const { id } = await params;
  const project = await getProjectDetail(user.id, id).catch((e: unknown) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const ready = project.asset?.status === "READY";
  const [playbackUrl, marks] = ready
    ? await Promise.all([getAssetPlaybackUrl(user.id, project.asset!.id), listAthleteMarks(user.id, id)])
    : [null, []];

  return (
    <>
      <PageHeader
        back={<Link href={`/projetos/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />{project.name}</Link>}
        title="Identificar o atleta"
        description="Mostre ao sistema quem é o atleta: pause o vídeo num momento em que ele aparece e clique em cima dele."
        actions={marks.length > 0 ? <ButtonLink href={`/projetos/${id}`} variant="secondary">Concluir</ButtonLink> : undefined}
      />
      <Alert tone="info" className="mb-6" title="Para que serve">
        Essas marcações vão alimentar a sugestão automática dos lances em que o atleta toca na bola, que está em desenvolvimento.
        A marcação não aparece nos vídeos cortados.
      </Alert>
      {!ready ? (
        <Alert tone="warning" title="Vídeo ainda não disponível">
          Envie o vídeo da partida e aguarde a validação para identificar o atleta.
        </Alert>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <AthleteMarker
              projectId={id}
              playbackUrl={playbackUrl!}
              durationMs={project.asset!.durationMs ?? 0}
              maxMarks={MAX_MARKS_PER_VIDEO}
              marks={marks.map((m) => ({ id: m.id, timeMs: m.timeMs, x: m.x, y: m.y }))}
            />
          </div>
          <div className="lg:col-span-2">
            <AthleteInfoForm
              projectId={id}
              athleteName={project.athleteName}
              jerseyColor={project.jerseyColor ?? ""}
              jerseyNumber={project.jerseyNumber ?? ""}
            />
          </div>
        </div>
      )}
    </>
  );
}
