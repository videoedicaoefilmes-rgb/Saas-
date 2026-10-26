import { beforeEach, describe, expect, it } from "vitest";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { testOutbox } from "@/server/mail";
import { getBalance } from "@/server/services/credits";
import { recordTermsAcceptance } from "@/server/services/account";
import { createUser, resetDb } from "../helpers";

function cookieFrom(headers: Headers): string {
  return headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

describe("autenticação", () => {
  beforeEach(async () => {
    await resetDb();
    testOutbox.length = 0;
  });

  it("cadastro cria usuário com papel USER, carteira e senha com hash", async () => {
    const u = await createUser({ email: "pai@teste.dev" });
    const user = await db.user.findUniqueOrThrow({ where: { id: u.id }, include: { accounts: true, wallet: true } });
    expect(user.role).toBe("USER");
    expect(user.wallet).not.toBeNull();
    expect(user.accounts[0]!.password).not.toContain("senha-segura-123");
    expect(await getBalance(u.id)).toBe(0);
  });

  it("registra aceite dos termos com versão", async () => {
    const u = await createUser();
    await recordTermsAcceptance(u.id);
    const user = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(user.termsVersion).toBe(process.env.TERMS_VERSION);
    expect(user.termsAcceptedAt).toBeInstanceOf(Date);
  });

  it("não permite definir o papel ADMIN pelo cadastro", async () => {
    const res = await auth.api.signUpEmail({
      body: { name: "X", email: "x@teste.dev", password: "senha-segura-123", role: "ADMIN" } as never,
    }).catch((e: unknown) => e);
    const user = await db.user.findUnique({ where: { email: "x@teste.dev" } });
    if (user) expect(user.role).toBe("USER");
    else expect(res).toBeInstanceOf(Error);
  });

  it("login com senha correta cria sessão; senha errada falha", async () => {
    const u = await createUser();
    const ok = await auth.api.signInEmail({ body: { email: u.email, password: u.password }, asResponse: true });
    expect(ok.status).toBe(200);
    const cookie = cookieFrom(ok.headers);
    const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
    expect(session?.user.id).toBe(u.id);

    const bad = await auth.api.signInEmail({ body: { email: u.email, password: "errada-123456" }, asResponse: true });
    expect(bad.status).toBe(401);
  });

  it("logout invalida a sessão", async () => {
    const u = await createUser();
    const res = await auth.api.signInEmail({ body: { email: u.email, password: u.password }, asResponse: true });
    const cookie = cookieFrom(res.headers);
    await auth.api.signOut({ headers: new Headers({ cookie }) });
    expect(await auth.api.getSession({ headers: new Headers({ cookie }) })).toBeNull();
  });

  it("sessão forjada não é aceita", async () => {
    const session = await auth.api.getSession({ headers: new Headers({ cookie: "gmclips.session_token=forjado.assinatura" }) });
    expect(session).toBeNull();
  });

  it("recuperação de senha: e-mail com link, troca de senha e revogação de sessões", async () => {
    const u = await createUser();
    const login = await auth.api.signInEmail({ body: { email: u.email, password: u.password }, asResponse: true });
    const oldCookie = cookieFrom(login.headers);

    await auth.api.requestPasswordReset({ body: { email: u.email } });
    expect(testOutbox).toHaveLength(1);
    const token = /token=([^\s]+)/.exec(testOutbox[0]!.text)?.[1];
    expect(token).toBeTruthy();

    await auth.api.resetPassword({ body: { newPassword: "nova-senha-456", token: decodeURIComponent(token!) } });
    const old = await auth.api.signInEmail({ body: { email: u.email, password: u.password }, asResponse: true });
    expect(old.status).toBe(401);
    const fresh = await auth.api.signInEmail({ body: { email: u.email, password: "nova-senha-456" }, asResponse: true });
    expect(fresh.status).toBe(200);
    expect(await auth.api.getSession({ headers: new Headers({ cookie: oldCookie }) })).toBeNull();
  });

  it("pedido de recuperação para e-mail inexistente não revela nada", async () => {
    const res = await auth.api.requestPasswordReset({ body: { email: "ninguem@teste.dev" } });
    expect(res.status).toBe(true);
    expect(testOutbox).toHaveLength(0);
  });
});
