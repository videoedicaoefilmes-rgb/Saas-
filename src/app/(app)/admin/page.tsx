import type { Metadata } from "next";
import { getOverviewMetrics } from "@/server/services/admin";
import { getEnv } from "@/server/env";
import { PageHeader, Stat } from "@/components/ui/misc";
import { Alert } from "@/components/ui/alert";
import { formatBytes, formatNumber } from "@/lib/utils";
import { formatDuration } from "@/lib/timecode";

export const metadata: Metadata = { title: "Administração" };

const fmt1 = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export default async function AdminHome() {
  const m = await getOverviewMetrics(30);
  const costConfigured = getEnv().INFRA_COST_CENTS_PER_PROCESSING_MINUTE !== null;
  return (
    <>
      <PageHeader title="Visão geral" description="Últimos 30 dias (exceto totais de usuários, projetos e armazenamento)." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Usuários" value={formatNumber(m.users)} hint={`${m.newUsers} novos no período`} />
        <Stat label="Projetos" value={formatNumber(m.projects)} />
        <Stat label="Vídeos enviados" value={formatNumber(m.uploads)} hint={`${fmt1(m.uploadedMinutes)} min · ${formatBytes(m.uploadedBytes)}`} />
        <Stat label="Minutos processados" value={fmt1(m.processedMinutes)} hint="soma dos lances cortados" />
        <Stat label="Processamentos" value={formatNumber(Object.values(m.jobs).reduce((a, b) => a + b, 0))} hint={`${m.jobs.SUCCEEDED ?? 0} ok · ${m.jobs.FAILED ?? 0} falhas · ${(m.jobs.QUEUED ?? 0) + (m.jobs.RUNNING ?? 0)} ativos`} />
        <Stat label="Taxa de erro" value={m.errorRate === null ? "—" : `${fmt1(m.errorRate * 100)}%`} />
        <Stat label="Tempo médio por job" value={m.avgProcessingMs ? formatDuration(m.avgProcessingMs) : "—"} hint={`${fmt1(m.processingMinutes)} min de CPU (parede) no total`} />
        <Stat label="Créditos consumidos" value={formatNumber(m.creditsConsumed)} />
        <Stat label="Arquivos gerados" value={formatBytes(m.outputBytes)} />
        <Stat label="Armazenamento em uso" value={formatBytes(m.storageBytes)} hint="vídeos ativos + cortes" />
        <Stat
          label="Custo estimado de infraestrutura"
          value={m.estimatedCostCents !== null ? `R$ ${(m.estimatedCostCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
          hint={costConfigured ? "pela taxa configurada" : "taxa não configurada"}
        />
      </div>
      {!costConfigured && (
        <Alert tone="info" className="mt-6" title="Custo real ainda não medido">
          Defina INFRA_COST_CENTS_PER_PROCESSING_MINUTE depois de medir o custo da infraestrutura escolhida (ver docs/ARCHITECTURE.md, seção Custos).
        </Alert>
      )}
    </>
  );
}
