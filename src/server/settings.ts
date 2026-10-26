import { z } from "zod";
import { db } from "./db";
import { getEnv } from "./env";
import type { PricingRule } from "@/lib/billing/pricing";

/**
 * Configurações operacionais. Valores padrão vêm do ambiente (.env); o painel
 * administrativo pode sobrescrevê-los (tabela app_settings). Toda alteração é auditada.
 */
export const settingsSchema = z.object({
  billingUnitSeconds: z.number().int().min(1).max(3600),
  creditsPerUnit: z.number().int().min(1).max(1000),
  billingMinCredits: z.number().int().min(0).max(1000),
  signupBonusCredits: z.number().int().min(0).max(10000),
  testCreditsEnabled: z.boolean(),
  testCreditsAmount: z.number().int().min(1).max(10000),
  maxClipsPerJob: z.number().int().min(1).max(500),
  maxClipDurationSeconds: z.number().int().min(1).max(3600),
  maxActiveJobsPerUser: z.number().int().min(1).max(50),
  processingPaused: z.boolean(),
  uploadsPaused: z.boolean(),
});

export type Settings = z.infer<typeof settingsSchema>;
export type SettingKey = keyof Settings;

export const SETTING_LABELS: Record<SettingKey, string> = {
  billingUnitSeconds: "Unidade de cobrança (segundos de vídeo processado)",
  creditsPerUnit: "Créditos por unidade",
  billingMinCredits: "Cobrança mínima por processamento (créditos)",
  signupBonusCredits: "Créditos de boas-vindas no cadastro",
  testCreditsEnabled: "Permitir créditos de teste pelo usuário",
  testCreditsAmount: "Quantidade por solicitação de créditos de teste",
  maxClipsPerJob: "Máximo de lances por processamento",
  maxClipDurationSeconds: "Duração máxima de um lance (segundos)",
  maxActiveJobsPerUser: "Processamentos simultâneos por usuário",
  processingPaused: "Pausar novos processamentos (manutenção)",
  uploadsPaused: "Pausar novos uploads (manutenção)",
};

export function defaultSettings(): Settings {
  const env = getEnv();
  return {
    billingUnitSeconds: env.BILLING_UNIT_SECONDS,
    creditsPerUnit: env.CREDITS_PER_UNIT,
    billingMinCredits: env.BILLING_MIN_CREDITS,
    signupBonusCredits: env.SIGNUP_BONUS_CREDITS,
    testCreditsEnabled: env.ENABLE_TEST_CREDITS,
    testCreditsAmount: env.TEST_CREDITS_AMOUNT,
    maxClipsPerJob: 50,
    maxClipDurationSeconds: 300,
    maxActiveJobsPerUser: 2,
    processingPaused: false,
    uploadsPaused: false,
  };
}

export async function getSettings(): Promise<Settings> {
  const defaults = defaultSettings();
  const rows = await db.appSetting.findMany();
  const merged: Record<string, unknown> = { ...defaults };
  for (const row of rows) {
    if (row.key in defaults) merged[row.key] = row.value;
  }
  const parsed = settingsSchema.safeParse(merged);
  // Valor corrompido no banco nunca derruba a aplicação: volta ao padrão.
  return parsed.success ? parsed.data : defaults;
}

export function pricingRuleFrom(settings: Settings): PricingRule {
  return {
    version: 1,
    unitSeconds: settings.billingUnitSeconds,
    creditsPerUnit: settings.creditsPerUnit,
    minCredits: settings.billingMinCredits,
  };
}

export async function updateSettings(patch: Partial<Settings>, actorUserId: string): Promise<Settings> {
  const current = await getSettings();
  const next = settingsSchema.parse({ ...current, ...patch });
  const changed = (Object.keys(patch) as SettingKey[]).filter((k) => current[k] !== next[k]);
  if (changed.length === 0) return current;

  await db.$transaction(async (tx) => {
    for (const key of changed) {
      await tx.appSetting.upsert({
        where: { key },
        create: { key, value: next[key], updatedById: actorUserId },
        update: { value: next[key], updatedById: actorUserId },
      });
    }
    await tx.auditLog.create({
      data: {
        actorUserId,
        action: "settings.update",
        targetType: "AppSetting",
        metadata: Object.fromEntries(changed.map((k) => [k, { from: current[k], to: next[k] }])),
      },
    });
  });
  return next;
}
