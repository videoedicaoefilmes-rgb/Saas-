import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { db } from "./db";
import { getEnv } from "./env";
import { sendMail } from "./mail";
import { grantSignupBonus } from "./services/credits";
import { logger } from "./logger";

const env = getEnv();

/**
 * Autenticação com Better Auth (e-mail + senha, sessões no banco, cookies httpOnly).
 * Senhas são armazenadas com hash (scrypt) pela própria biblioteca.
 */
export const auth = betterAuth({
  appName: env.APP_NAME,
  baseURL: env.BETTER_AUTH_URL ?? env.APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),
  telemetry: { enabled: false },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    sendResetPassword: async ({ user, token }) => {
      const link = `${env.APP_URL}/redefinir-senha?token=${encodeURIComponent(token)}`;
      await sendMail({
        to: user.email,
        subject: `${env.APP_NAME}: redefinição de senha`,
        text:
          `Olá, ${user.name}.\n\n` +
          `Recebemos um pedido para redefinir a sua senha. Use o link abaixo (válido por 1 hora):\n\n${link}\n\n` +
          `Se você não fez esse pedido, ignore este e-mail — sua senha continua a mesma.`,
      });
    },
  },
  user: {
    additionalFields: {
      role: { type: "string", input: false, defaultValue: "USER", required: false },
      termsAcceptedAt: { type: "date", input: false, required: false },
      termsVersion: { type: "string", input: false, required: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  rateLimit: {
    // Ativo em produção. Armazenamento em memória: suficiente para uma instância web;
    // com várias instâncias, trocar para "database" ou Redis (ver docs/SECURITY.md).
    enabled: env.NODE_ENV === "production",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 300, max: 5 },
      "/request-password-reset": { window: 300, max: 3 },
    },
  },
  advanced: {
    cookiePrefix: "gmclips",
    useSecureCookies: env.NODE_ENV === "production",
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          try {
            await grantSignupBonus(user.id);
          } catch (err) {
            // A carteira também é criada sob demanda; não impede o cadastro.
            logger.error({ err, userId: user.id }, "Falha ao criar carteira/bônus de cadastro");
          }
        },
      },
    },
  },
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
