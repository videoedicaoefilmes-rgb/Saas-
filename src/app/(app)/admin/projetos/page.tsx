import type { Metadata } from "next";
import Link from "next/link";
import { listProjectsAdmin } from "@/server/services/admin";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, Table, Td, Th } from "@/components/ui/misc";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Projetos · Admin" };

export default async function AdminProjects() {
  const projects = await listProjectsAdmin();
  return (
    <>
      <PageHeader title="Projetos" description="Últimos 100 projetos. Por privacidade, vídeos de clientes não são exibidos aqui." />
      <Card>
        <CardContent className="p-0">
          <Table>
            <thead><tr><Th>Projeto</Th><Th>Usuário</Th><Th>Criado</Th><Th className="text-right">Lances</Th><Th className="text-right">Jobs</Th></tr></thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <Td className="font-medium">{p.name}</Td>
                  <Td><Link href={`/admin/usuarios/${p.user.id}`} className="text-primary hover:underline">{p.user.email}</Link></Td>
                  <Td className="whitespace-nowrap text-xs">{formatDateTime(p.createdAt)}</Td>
                  <Td className="text-right tabular">{p._count.clips}</Td>
                  <Td className="text-right tabular">{p._count.processingJobs}</Td>
                </tr>
              ))}
              {projects.length === 0 && <tr><Td colSpan={5} className="py-8 text-center text-muted-foreground">Nenhum projeto.</Td></tr>}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
