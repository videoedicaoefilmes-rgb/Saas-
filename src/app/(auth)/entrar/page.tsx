import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/session";
import { Alert } from "@/components/ui/alert";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function SignInPage({ searchParams }: PageProps<"/entrar">) {
  if (await getCurrentUser()) redirect("/painel");
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/painel";
  return (
    <>
      <h1 className="text-2xl font-bold">Entrar</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Ainda não tem conta? <Link href="/cadastro" className="font-semibold text-primary hover:underline">Cadastre-se</Link>
      </p>
      {sp.senha === "redefinida" && <Alert tone="success" className="mb-4">Senha redefinida. Entre com a nova senha.</Alert>}
      <SignInForm next={next} />
    </>
  );
}
