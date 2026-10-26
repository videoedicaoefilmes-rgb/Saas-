import type { Metadata } from "next";
import Link from "next/link";
import { Coins } from "lucide-react";
import { requireUser } from "@/server/session";
import { getBalance, listTransactions } from "@/server/services/credits";
import { getSettings } from "@/server/settings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, Stat, Table, Td, Th } from "@/components/ui/misc";
import { Alert } from "@/components/ui/alert";
import { TX_LABELS } from "@/components/status";
import { credits, formatDateTime, formatNumber } from "@/lib/utils";
import { TestCreditsButton } from "./test-credits";

export const metadata: Metadata = { title: "Créditos e faturamento" };

export default async function CreditsPage() {
  const user = await requireUser();
  const [balance, txs, settings] = await Promise.all([getBalance(user.id), listTransactions(user.id, 100), getSettings()]);

  return (
    <>
      <PageHeader title="Créditos e faturamento" description="Os créditos pagam o processamento dos lances. O saldo é calculado e guardado no servidor." />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Stat label="Saldo disponível" value={formatNumber(balance)} hint="créditos" />
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Como o consumo é calculado</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              {credits(settings.creditsPerUnit)} a cada {settings.billingUnitSeconds} segundos de lances cortados (soma dos trechos, já com as margens), com mínimo de{" "}
              {credits(settings.billingMinCredits)} por processamento. A duração total do jogo não é cobrada.
            </p>
            <p className="mt-2">Os créditos ficam reservados durante o processamento e são devolvidos automaticamente se ele falhar.</p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Comprar créditos e planos</CardTitle>
            <CardDescription>Pacotes avulsos, assinatura mensal e planos profissionais.</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert tone="info" title="Ainda não disponível">
              A cobrança (Pix e cartão) ainda não está ativa. Os valores dos planos serão definidos antes do lançamento comercial.
            </Alert>
          </CardContent>
        </Card>
        {settings.testCreditsEnabled && (
          <Card>
            <CardHeader>
              <CardTitle>Créditos de teste</CardTitle>
              <CardDescription>Ambiente de desenvolvimento/homologação: créditos sem valor comercial, limitados por dia.</CardDescription>
            </CardHeader>
            <CardContent>
              <TestCreditsButton amount={settings.testCreditsAmount} />
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Extrato</CardTitle>
          <CardDescription>Todas as movimentações da sua conta, da mais recente para a mais antiga.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {txs.length === 0 ? (
            <div className="p-5"><EmptyState icon={<Coins />} title="Nenhuma movimentação ainda" /></div>
          ) : (
            <Table data-testid="ledger">
              <thead>
                <tr><Th>Data</Th><Th>Tipo</Th><Th className="hidden sm:table-cell">Detalhe</Th><Th className="text-right">Valor</Th><Th className="text-right">Saldo</Th></tr>
              </thead>
              <tbody>
                {txs.map((t) => (
                  <tr key={t.id}>
                    <Td className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(t.createdAt)}</Td>
                    <Td className="whitespace-nowrap">{TX_LABELS[t.type] ?? t.type}</Td>
                    <Td className="hidden text-xs text-muted-foreground sm:table-cell">
                      {t.job ? <Link href={`/processamentos/${t.jobId}`} className="text-primary hover:underline">{t.job.project.name}</Link> : t.reason}
                    </Td>
                    <Td className={`text-right font-semibold tabular ${t.amount > 0 ? "text-primary" : t.amount < 0 ? "text-danger" : "text-muted-foreground"}`}>
                      {t.amount > 0 ? "+" : ""}{formatNumber(t.amount)}
                    </Td>
                    <Td className="text-right tabular">{formatNumber(t.balanceAfter)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
