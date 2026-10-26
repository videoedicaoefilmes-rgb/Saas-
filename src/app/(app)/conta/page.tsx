import type { Metadata } from "next";
import { requireUser } from "@/server/session";
import { db } from "@/server/db";
import { getEnv } from "@/server/env";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { formatDateTime } from "@/lib/utils";
import { ChangePasswordForm, DeleteAccountForm, NameForm } from "./forms";

export const metadata: Metadata = { title: "Conta" };

export default async function AccountPage() {
  const user = await requireUser();
  const details = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { createdAt: true, termsAcceptedAt: true, termsVersion: true } });
  const env = getEnv();
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader title="Configurações da conta" description={`Conta criada em ${formatDateTime(details.createdAt)}`} />
      <Card>
        <CardHeader><CardTitle>Perfil</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm"><span className="text-muted-foreground">E-mail:</span> <span className="font-medium">{user.email}</span></p>
          <NameForm name={user.name} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Alterar senha</CardTitle></CardHeader>
        <CardContent><ChangePasswordForm /></CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Privacidade e dados</CardTitle>
          <CardDescription>
            Termos aceitos em {formatDateTime(details.termsAcceptedAt)} (versão {details.termsVersion ?? "—"}).{" "}
            Vídeos enviados ficam guardados por {env.RETENTION_SOURCE_DAYS} dias e os cortes por {env.RETENTION_EXPORT_DAYS} dias; depois são excluídos automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <a href="/privacidade" className="text-sm text-primary hover:underline">Ler a Política de Privacidade</a>
        </CardContent>
      </Card>
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-danger">Excluir conta</CardTitle>
          <CardDescription>Remove permanentemente sua conta, projetos, vídeos, cortes e histórico de créditos. Não pode ser desfeito.</CardDescription>
        </CardHeader>
        <CardContent><DeleteAccountForm /></CardContent>
      </Card>
    </div>
  );
}
