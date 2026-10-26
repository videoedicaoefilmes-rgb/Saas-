"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/server/auth";
import { recordTermsAcceptance } from "@/server/services/account";
import { formString, toActionError, withFields, type ActionResult } from "@/server/action-result";

const email = z.email("Informe um e-mail válido.").trim().toLowerCase().max(200);
const password = z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").max(128, "Senha longa demais.");

/** Aceita apenas caminhos internos como destino após o login (evita open redirect). */
function safeNext(next: string): string {
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/painel";
}

const signUpSchema = z
  .object({
    name: z.string().trim().min(2, "Informe seu nome.").max(80, "Nome longo demais."),
    email,
    password,
    confirmPassword: z.string(),
    acceptTerms: z.literal("on", { error: "É preciso aceitar os Termos de Uso e a Política de Privacidade." }),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "As senhas não conferem." });

export async function signUpAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const input = signUpSchema.parse({
      name: formString(form, "name"),
      email: formString(form, "email"),
      password: formString(form, "password"),
      confirmPassword: formString(form, "confirmPassword"),
      acceptTerms: formString(form, "acceptTerms"),
    });
    const res = await auth.api.signUpEmail({
      body: { name: input.name, email: input.email, password: input.password },
      headers: await headers(),
    });
    await recordTermsAcceptance(res.user.id);
  } catch (err) {
    return withFields(toActionError(err), form, ["name", "email"]);
  }
  redirect("/painel?bemvindo=1");
}

const signInSchema = z.object({ email, password: z.string().min(1, "Informe a senha.").max(128) });

export async function signInAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const input = signInSchema.parse({ email: formString(form, "email"), password: formString(form, "password") });
    await auth.api.signInEmail({ body: input, headers: await headers() });
  } catch (err) {
    return withFields(toActionError(err), form, ["email"]);
  }
  redirect(safeNext(formString(form, "next")));
}

export async function signOutAction(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  redirect("/");
}

export async function requestPasswordResetAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const input = z.object({ email }).parse({ email: formString(form, "email") });
    await auth.api.requestPasswordReset({ body: { email: input.email }, headers: await headers() });
    // Mesma resposta exista ou não a conta (não revela e-mails cadastrados).
    return { ok: true, message: "Se houver uma conta com este e-mail, você receberá um link para redefinir a senha em instantes." };
  } catch (err) {
    return withFields(toActionError(err), form, ["email"]);
  }
}

const resetSchema = z
  .object({ token: z.string().min(10, "Link inválido."), password, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "As senhas não conferem." });

export async function resetPasswordAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const input = resetSchema.parse({
      token: formString(form, "token"),
      password: formString(form, "password"),
      confirmPassword: formString(form, "confirmPassword"),
    });
    await auth.api.resetPassword({ body: { token: input.token, newPassword: input.password }, headers: await headers() });
  } catch (err) {
    return toActionError(err);
  }
  redirect("/entrar?senha=redefinida");
}
