import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-form";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Recuperar senha</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.</p>
      <ForgotPasswordForm />
      <p className="mt-6 text-center text-sm">
        <Link href="/entrar" className="text-primary hover:underline">Voltar para o login</Link>
      </p>
    </>
  );
}
