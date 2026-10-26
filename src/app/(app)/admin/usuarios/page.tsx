import type { Metadata } from "next";
import Link from "next/link";
import { listUsers } from "@/server/services/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Table, Td, Th } from "@/components/ui/misc";
import { formatDateTime, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Usuários · Admin" };

export default async function AdminUsers({ searchParams }: PageProps<"/admin/usuarios">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const users = await listUsers({ query: q });
  return (
    <>
      <PageHeader title="Usuários" description="Últimos 100 cadastros (ou resultado da busca)." />
      <form className="mb-4 flex max-w-md gap-2">
        <Input name="q" defaultValue={q} placeholder="Buscar por nome ou e-mail" aria-label="Buscar usuários" />
        <Button type="submit" variant="secondary">Buscar</Button>
      </form>
      <Card>
        <CardContent className="p-0">
          <Table>
            <thead><tr><Th>Usuário</Th><Th>Cadastro</Th><Th className="text-right">Projetos</Th><Th className="text-right">Jobs</Th><Th className="text-right">Saldo</Th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <Td>
                    <Link href={`/admin/usuarios/${u.id}`} className="font-medium text-primary hover:underline">{u.name}</Link>
                    <p className="text-xs text-muted-foreground">{u.email} {u.role === "ADMIN" && <Badge tone="info">admin</Badge>}</p>
                  </Td>
                  <Td className="whitespace-nowrap text-xs">{formatDateTime(u.createdAt)}</Td>
                  <Td className="text-right tabular">{u._count.projects}</Td>
                  <Td className="text-right tabular">{u._count.processingJobs}</Td>
                  <Td className="text-right font-semibold tabular">{formatNumber(u.wallet?.balance ?? 0)}</Td>
                </tr>
              ))}
              {users.length === 0 && <tr><Td colSpan={5} className="py-8 text-center text-muted-foreground">Nenhum usuário encontrado.</Td></tr>}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
