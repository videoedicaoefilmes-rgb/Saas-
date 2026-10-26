import type { Metadata } from "next";
import Link from "next/link";
import { FolderPlus } from "lucide-react";
import { requireUser } from "@/server/session";
import { listProjects } from "@/server/services/projects";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Alert } from "@/components/ui/alert";
import { AssetStatusBadge, JobStatusBadge } from "@/components/status";
import { formatDateTime } from "@/lib/utils";
import { formatDuration } from "@/lib/timecode";

export const metadata: Metadata = { title: "Projetos" };

export default async function ProjectsPage({ searchParams }: PageProps<"/projetos">) {
  const user = await requireUser();
  const projects = await listProjects(user.id);
  const sp = await searchParams;
  return (
    <>
      <PageHeader title="Projetos" description="Um projeto por partida (ou por atleta)." actions={<ButtonLink href="/projetos/novo"><FolderPlus />Novo projeto</ButtonLink>} />
      {sp.excluido && <Alert tone="success" className="mb-4">Projeto excluído.</Alert>}
      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderPlus />}
          title="Nenhum projeto ainda"
          description="Crie seu primeiro projeto, envie o vídeo da partida e marque os lances."
          action={<ButtonLink href="/projetos/novo">Criar primeiro projeto</ButtonLink>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const asset = p.mediaAssets[0];
            const job = p.processingJobs[0];
            return (
              <Link key={p.id} href={`/projetos/${p.id}`} className="group">
                <Card className="flex h-full flex-col gap-3 p-5 transition-shadow group-hover:shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold leading-snug break-words">{p.name}</h2>
                    {job ? <JobStatusBadge status={job.status} /> : <AssetStatusBadge status={asset?.status} />}
                  </div>
                  <p className="text-sm text-muted-foreground">{[p.athleteName, p.matchName].filter(Boolean).join(" · ") || "Sem atleta/partida"}</p>
                  <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
                    <span>{p._count.clips} lance(s){asset?.durationMs ? ` · vídeo de ${formatDuration(asset.durationMs)}` : ""}</span>
                    <span>{formatDateTime(p.updatedAt)}</span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
