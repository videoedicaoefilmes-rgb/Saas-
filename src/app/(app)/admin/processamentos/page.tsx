import type { Metadata } from "next";
import Link from "next/link";
import { listJobsAdmin } from "@/server/services/admin";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, Table, Td, Th } from "@/components/ui/misc";
import { JobStatusBadge } from "@/components/status";
import { formatBytes, formatDateTime } from "@/lib/utils";
import { formatDuration } from "@/lib/timecode";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Processamentos · Admin" };

const filters = [["", "Todos"], ["QUEUED", "Na fila"], ["RUNNING", "Processando"], ["SUCCEEDED", "Concluídos"], ["FAILED", "Com erro"]] as const;

export default async function AdminJobs({ searchParams }: PageProps<"/admin/processamentos">) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "";
  const jobs = await listJobsAdmin({ status });
  return (
    <>
      <PageHeader title="Processamentos" description="ID = identificador de correlação nos logs do worker." />
      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map(([value, label]) => (
          <Link key={value} href={value ? `/admin/processamentos?status=${value}` : "/admin/processamentos"} className={cn("rounded-full border px-3 py-1 text-sm", status === value ? "border-primary bg-primary-soft text-primary" : "border-border bg-card")}>
            {label}
          </Link>
        ))}
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <thead><tr><Th>Criado</Th><Th>Usuário / projeto</Th><Th>Status</Th><Th className="text-right">Lances</Th><Th className="text-right">Seg. cobrados</Th><Th className="text-right">Créditos</Th><Th className="text-right">Tempo</Th><Th className="text-right">Saída</Th><Th>ID / erro</Th></tr></thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <Td className="whitespace-nowrap text-xs">{formatDateTime(j.createdAt)}</Td>
                  <Td><span className="text-xs">{j.user.email}</span><p className="text-xs text-muted-foreground">{j.project.name}</p></Td>
                  <Td><JobStatusBadge status={j.status} /><p className="text-[11px] text-muted-foreground">{j.creditStatus} · tent. {j.attempts}</p></Td>
                  <Td className="text-right tabular">{j.clipCount}</Td>
                  <Td className="text-right tabular">{j.billableSeconds}</Td>
                  <Td className="text-right tabular">{j.creditsCharged}</Td>
                  <Td className="text-right tabular whitespace-nowrap">{j.processingMs !== null ? formatDuration(j.processingMs) : "—"}</Td>
                  <Td className="text-right tabular whitespace-nowrap">{j.outputBytes !== null ? formatBytes(j.outputBytes) : "—"}</Td>
                  <Td className="max-w-56 text-xs"><code className="break-all">{j.id}</code>{j.errorCode && <p className="text-danger">{j.errorCode}</p>}</Td>
                </tr>
              ))}
              {jobs.length === 0 && <tr><Td colSpan={9} className="py-8 text-center text-muted-foreground">Nenhum processamento.</Td></tr>}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
