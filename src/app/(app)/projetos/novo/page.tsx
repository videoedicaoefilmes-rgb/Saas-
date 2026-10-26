import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/server/session";
import { createProjectAction } from "@/app/actions/projects";
import { ProjectForm } from "@/components/project-form";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Novo projeto" };

export default async function NewProjectPage() {
  await requireUser();
  return (
    <div className="max-w-3xl">
      <PageHeader
        back={<Link href="/projetos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Projetos</Link>}
        title="Novo projeto"
        description="Um projeto reúne o vídeo de uma partida e os lances que você quer cortar. Depois de criar, você envia o vídeo."
      />
      <Card>
        <CardContent className="py-6">
          <ProjectForm action={createProjectAction} submitLabel="Criar projeto e enviar vídeo" />
        </CardContent>
      </Card>
    </div>
  );
}
