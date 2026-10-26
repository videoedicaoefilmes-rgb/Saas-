import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { ResetPasswordForm } from "./reset-form";

export const metadata: Metadata = { title: "Nova senha" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/redefinir-senha">) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  return (
    <>
      <h1 className="text-2xl font-bold">Criar nova senha</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">Por segurança, todas as sessões abertas serão encerradas.</p>
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <Alert tone="error" title="Link inválido">
          Abra o link enviado por e-mail ou <Link href="/recuperar-senha" className="underline">peça um novo</Link>.
        </Alert>
      )}
    </>
  );
}
