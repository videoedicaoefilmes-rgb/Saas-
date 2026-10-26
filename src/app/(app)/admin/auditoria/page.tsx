import type { Metadata } from "next";
import { listAuditLogs } from "@/server/services/admin";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, Table, Td, Th } from "@/components/ui/misc";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Auditoria · Admin" };

export default async function AdminAudit() {
  const logs = await listAuditLogs(200);
  return (
    <>
      <PageHeader title="Auditoria" description="Ações sensíveis: ajustes de créditos, configurações, exclusões e aceite de termos." />
      <Card>
        <CardContent className="p-0">
          <Table>
            <thead><tr><Th>Data</Th><Th>Ação</Th><Th>Quem</Th><Th>Alvo</Th><Th>Detalhes</Th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <Td className="whitespace-nowrap text-xs">{formatDateTime(l.createdAt)}</Td>
                  <Td className="font-mono text-xs">{l.action}</Td>
                  <Td className="text-xs">{l.actor?.email ?? "sistema"}</Td>
                  <Td className="text-xs">{l.targetType} <code className="text-muted-foreground">{l.targetId}</code></Td>
                  <Td className="max-w-80"><code className="block truncate text-xs text-muted-foreground" title={JSON.stringify(l.metadata)}>{l.metadata ? JSON.stringify(l.metadata) : ""}</code></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
