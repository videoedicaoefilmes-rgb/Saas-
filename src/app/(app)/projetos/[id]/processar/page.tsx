import type { Metadata } from "next";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { ArrowLeft, Coins } from "lucide-react";
import { requireUser } from "@/server/session";
import { AppError } from "@/server/errors";
import { getSettings } from "@/server/settings";
import { planProcessing } from "@/server/services/processing";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, Table, Td, Th } from "@/components/ui/misc";
import { formatDuration, formatTimecode } from "@/lib/timecode";
import { credits, formatNumber } from "@/lib/utils";
import { ConfirmForm } from "./confirm-form";

export const metadata: Metadata = { title: "Confirmar processamento" };

export default async function ProcessPage({ params }: PageProps<"/projetos/[id]/processar">) {
  const user = await requireUser();
  const { id } = await params;
  const plan = await planProcessing(user.id, id).catch((e: unknown) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const settings = await getSettings();
  const { estimate } = plan;
  const after = plan.balance - estimate.credits;
  const minutes = estimate.billableSeconds / 60;

  return (
    <div className="max-w-4xl">
      <PageHeader
        back={<Link href={`/projetos/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Voltar ao projeto</Link>}
        title="Confirmar processamento"
        description="Revise os lances e o custo. Os créditos só são consumidos se o processamento terminar; em caso de falha, são devolvidos automaticamente."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{plan.clips.length} lance(s) a cortar</CardTitle>
            <CardDescription>Modo: {plan.cutMode === "PRECISE" ? "preciso (recodifica)" : "rápido (sem recodificar)"} · horários já com as margens do projeto</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <thead>
                <tr><Th>#</Th><Th>Trecho</Th><Th>Duração</Th><Th className="hidden sm:table-cell">Arquivo</Th></tr>
              </thead>
              <tbody>
                {plan.clips.map((c) => (
                  <tr key={c.clipId}>
                    <Td className="font-semibold">{c.position}</Td>
                    <Td className="tabular whitespace-nowrap">{formatTimecode(c.startMs)} → {formatTimecode(c.endMs)}</Td>
                    <Td className="tabular whitespace-nowrap">{formatDuration(c.endMs - c.startMs)}</Td>
                    <Td className="hidden font-mono text-xs break-all sm:table-cell">{c.filename}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>

        <Card className="lg:self-start">
          <CardHeader className="flex-row items-center gap-2">
            <Coins className="size-4 text-accent" />
            <CardTitle>Custo</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Vídeo a processar</dt><dd className="tabular">{formatNumber(estimate.billableSeconds)} s ({minutes.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} min)</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Regra</dt><dd className="text-right">{credits(settings.creditsPerUnit)} a cada {settings.billingUnitSeconds} s iniciados</dd></div>
              <div className="flex justify-between border-t border-border pt-2 text-base"><dt className="font-semibold">Total</dt><dd className="font-bold tabular" data-testid="cost">{credits(estimate.credits)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Seu saldo</dt><dd className="tabular">{formatNumber(plan.balance)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Saldo após</dt><dd className={`tabular font-semibold ${after < 0 ? "text-danger" : ""}`}>{formatNumber(after)}</dd></div>
            </dl>
            {plan.blockers.length > 0 ? (
              <div className="flex flex-col gap-3">
                {plan.blockers.map((b) => <Alert key={b} tone="warning">{b}</Alert>)}
                {estimate.credits > plan.balance && <ButtonLink href="/creditos" variant="secondary">Ver créditos</ButtonLink>}
                <ButtonLink href={`/projetos/${id}/lances`} variant="ghost">Revisar lances</ButtonLink>
              </div>
            ) : (
              <ConfirmForm projectId={id} expectedCredits={estimate.credits} idempotencyKey={randomUUID()} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
