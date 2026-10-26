import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/server/session";
import { AppError } from "@/server/errors";
import { getOwnedProject } from "@/server/services/projects";
import { updateProjectAction } from "@/app/actions/projects";
import { ProjectForm } from "@/components/project-form";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { DeleteProjectCard } from "./delete-project";

export const metadata: Metadata = { title: "Editar projeto" };

export default async function EditProjectPage({ params }: PageProps<"/projetos/[id]/editar">) {
  const user = await requireUser();
  const { id } = await params;
  const project = await getOwnedProject(user.id, id).catch((e: unknown) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader
        back={<Link href={`/projetos/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />{project.name}</Link>}
        title="Editar projeto"
      />
      <Card>
        <CardContent className="py-6">
          <ProjectForm
            action={updateProjectAction.bind(null, id)}
            submitLabel="Salvar alterações"
            defaults={{
              name: project.name,
              athleteName: project.athleteName ?? "",
              teamName: project.teamName ?? "",
              matchName: project.matchName ?? "",
              matchDate: project.matchDate ? project.matchDate.toISOString().slice(0, 10) : "",
              cutMode: project.cutMode,
              paddingBeforeSeconds: project.paddingBeforeMs / 1000,
              paddingAfterSeconds: project.paddingAfterMs / 1000,
            }}
          />
        </CardContent>
      </Card>
      <DeleteProjectCard projectId={id} />
    </div>
  );
}
