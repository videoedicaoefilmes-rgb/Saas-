import type { Metadata } from "next";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getUserDetail } from "@/server/services/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, Stat, Table, Td, Th } from "@/components/ui/misc";
import { JobStatusBadge, TX_LABELS } from "@/components/status";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { AdjustCreditsForm } from "./adjust-form";

export const metadata: Metadata = { title: "Usuário · Admin" };

export default async function AdminUserDetail({ params }: PageProps<"/admin/usuarios/[id]">) {
  const { id } = await params;
  const user = await getUserDetail(id);
  if (!user) notFound();
  return (
    <>
      <PageHeader
        back={<Link href="/admin/usuarios" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Usuários</Link>}
        title={user.name}
        description={`${user.email} · cadastro em ${formatDateTime(user.createdAt)} · termos ${user.termsVersion ?? "não registrados"}`}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4">
          <Stat label="Saldo" value={formatNumber(user.wallet?.balance ?? 0)} />
          <Card>
            <CardHeader>
              <CardTitle>Ajustar créditos</CardTitle>
              <CardDescription>Valor positivo credita, negativo debita. Fica registrado com seu usuário e a justificativa.</CardDescription>
            </CardHeader>
            <CardContent><AdjustCreditsForm userId={user.id} idempotencyKey={randomUUID()} /></CardContent>
          </Card>
        </div>
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Movimentações</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <thead><tr><Th>Data</Th><Th>Tipo</Th><Th>Motivo</Th><Th className="text-right">Valor</Th><Th className="text-right">Saldo</Th></tr></thead>
                <tbody>
                  {user.creditTransactions.map((t) => (
                    <tr key={t.id}>
                      <Td className="whitespace-nowrap text-xs">{formatDateTime(t.createdAt)}</Td>
                      <Td className="whitespace-nowrap">{TX_LABELS[t.type] ?? t.type}</Td>
                      <Td className="text-xs text-muted-foreground">{t.reason}{t.actor ? ` (por ${t.actor.name})` : ""}</Td>
                      <Td className="text-right tabular">{t.amount > 0 ? "+" : ""}{t.amount}</Td>
                      <Td className="text-right tabular">{t.balanceAfter}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Processamentos recentes</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <thead><tr><Th>Data</Th><Th>Projeto</Th><Th>Status</Th><Th className="text-right">Créditos</Th></tr></thead>
                <tbody>
                  {user.processingJobs.map((j) => (
                    <tr key={j.id}>
                      <Td className="whitespace-nowrap text-xs">{formatDateTime(j.createdAt)}</Td>
                      <Td>{j.project.name}</Td>
                      <Td><JobStatusBadge status={j.status} /></Td>
                      <Td className="text-right tabular">{j.creditsCharged}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
