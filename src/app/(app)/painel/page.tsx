import type { Metadata } from "next";
import Link from "next/link";
import { FolderPlus, History, Coins } from "lucide-react";
import { requireUser } from "@/server/session";
import { getUserDashboardStats } from "@/server/services/dashboard";
import { getBalance } from "@/server/services/credits";
import { listProjects } from "@/server/services/projects";
import { listJobs } from "@/server/services/processing";
import { getSettings } from "@/server/settings";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, Stat } from "@/components/ui/misc";
import { Alert } from "@/components/ui/alert";
import { AssetStatusBadge, JobStatusBadge } from "@/components/status";
import { formatDateTime, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Painel" };

export default async function DashboardPage({ searchParams }: PageProps<"/painel">) {
  const user = await requireUser();
  const sp = await searchParams;
  const [balance, projects, jobs, stats, settings] = await Promise.all([
    getBalance(user.id),
    listProjects(user.id, { take: 6 }),
    listJobs(user.id, 8),
    getUserDashboardStats(user.id, 30),
    getSettings(),
  ]);

  return (
    <>
      <PageHeader
        title={`Olá, ${user.name.split(" ")[0]}`}
        description="Acompanhe seus projetos e processamentos."
        actions={<ButtonLink href="/projetos/novo"><FolderPlus />Novo projeto</ButtonLink>}
      />
      {sp.bemvindo && (
        <Alert tone="success" title="Conta criada!" className="mb-6">
          Comece criando um projeto para a partida.
          {balance === 0 && settings.testCreditsEnabled && (
            <> Neste ambiente de testes você pode <Link href="/creditos" className="font-semibold underline">adicionar créditos de teste</Link>.</>
          )}
        </Alert>
      )}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Créditos disponíveis" value={formatNumber(balance)} hint={<Link href="/creditos" className="text-primary hover:underline">Ver extrato</Link>} />
        <Stat label="Processando agora" value={stats.activeJobs} />
        <Stat label="Lances cortados (30 dias)" value={formatNumber(stats.clipsProcessed)} />
        <Stat label="Minutos processados (30 dias)" value={stats.minutesProcessed.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Projetos recentes</CardTitle>
            <Link href="/projetos" className="text-sm text-primary hover:underline">Ver todos</Link>
          </CardHeader>
          <CardContent className="p-0">
            {projects.length === 0 ? (
              <div className="p-5">
                <EmptyState icon={<FolderPlus />} title="Nenhum projeto ainda" description="Crie um projeto para cada partida ou atleta." action={<ButtonLink href="/projetos/novo" size="sm">Criar projeto</ButtonLink>} />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {projects.map((p) => (
                  <li key={p.id}>
                    <Link href={`/projetos/${p.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/60">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{p.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[p.athleteName, p.matchName].filter(Boolean).join(" · ") || "Sem atleta/partida"} · {p._count.clips} lance(s)
                        </p>
                      </div>
                      {p.processingJobs[0] ? <JobStatusBadge status={p.processingJobs[0].status} /> : <AssetStatusBadge status={p.mediaAssets[0]?.status} />}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center gap-2">
            <History className="size-4 text-muted-foreground" />
            <CardTitle>Histórico de processamento</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {jobs.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">Nenhum processamento ainda.</p>
            ) : (
              <ul className="divide-y divide-border">
                {jobs.map((j) => (
                  <li key={j.id}>
                    <Link href={`/processamentos/${j.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/60">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{j.project.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(j.createdAt)} · {j.clipCount} lance(s) · <Coins className="inline size-3" /> {j.creditsCharged}
                        </p>
                      </div>
                      <JobStatusBadge status={j.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
