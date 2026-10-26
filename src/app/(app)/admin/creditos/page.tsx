import type { Metadata } from "next";
import Link from "next/link";
import { listCreditTransactionsAdmin } from "@/server/services/admin";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, Table, Td, Th } from "@/components/ui/misc";
import { TX_LABELS } from "@/components/status";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Créditos · Admin" };

export default async function AdminCredits() {
  const txs = await listCreditTransactionsAdmin(200);
  return (
    <>
      <PageHeader title="Movimentações de créditos" description="Livro-razão completo (últimos 200 lançamentos). Lançamentos nunca são editados ou apagados." />
      <Card>
        <CardContent className="p-0">
          <Table>
            <thead><tr><Th>Data</Th><Th>Usuário</Th><Th>Tipo</Th><Th>Motivo</Th><Th className="text-right">Valor</Th><Th className="text-right">Saldo</Th></tr></thead>
            <tbody>
              {txs.map((t) => (
                <tr key={t.id}>
                  <Td className="whitespace-nowrap text-xs">{formatDateTime(t.createdAt)}</Td>
                  <Td><Link href={`/admin/usuarios/${t.user.id}`} className="text-xs text-primary hover:underline">{t.user.email}</Link></Td>
                  <Td className="whitespace-nowrap">{TX_LABELS[t.type] ?? t.type}</Td>
                  <Td className="text-xs text-muted-foreground">{t.reason}{t.actor ? ` (por ${t.actor.email})` : ""}</Td>
                  <Td className="text-right tabular">{t.amount > 0 ? "+" : ""}{t.amount}</Td>
                  <Td className="text-right tabular">{t.balanceAfter}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
