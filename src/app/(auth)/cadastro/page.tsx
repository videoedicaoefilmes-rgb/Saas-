import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/session";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Criar conta" };

export default async function SignUpPage() {
  if (await getCurrentUser()) redirect("/painel");
  return (
    <>
      <h1 className="text-2xl font-bold">Criar conta</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Já tem conta? <Link href="/entrar" className="font-semibold text-primary hover:underline">Entrar</Link>
      </p>
      <SignUpForm />
    </>
  );
}
