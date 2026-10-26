import { z } from "zod";

/**
 * Variáveis de ambiente validadas. Usado pela aplicação web, pelo worker e pelos testes.
 * Falha cedo (na inicialização) se algo obrigatório estiver ausente ou inválido.
 */

const bool = z
  .enum(["true", "false", "1", "0", ""])
  .default("false")
  .transform((v) => v === "true" || v === "1");

const optionalInt = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v.trim() === "" ? null : Number(v)))
  .pipe(z.number().int().nonnegative().nullable());

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_NAME: z.string().min(1).default("GM Sports Clips"),
    APP_URL: z.url().default("http://localhost:3000"),
    TERMS_VERSION: z.string().min(1).default("rascunho"),

    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET deve ter ao menos 32 caracteres"),
    BETTER_AUTH_URL: z.url().optional(),

    REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
    REDIS_PREFIX: z.string().min(1).default("gmclips"),

    STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
    STORAGE_LOCAL_DIR: z.string().min(1).default("./.data/storage"),
    STORAGE_SIGNING_SECRET: z.string().min(32).optional(),
    S3_ENDPOINT: z.string().optional(),
    S3_REGION: z.string().default("us-east-1"),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_FORCE_PATH_STYLE: bool,
    SIGNED_DOWNLOAD_TTL_SECONDS: z.coerce.number().int().min(30).max(3600).default(300),
    SIGNED_UPLOAD_TTL_SECONDS: z.coerce.number().int().min(60).max(86400).default(3600),

    UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(2 * 1024 ** 3),
    UPLOAD_MAX_DURATION_SECONDS: z.coerce.number().int().positive().default(3 * 3600),
    UPLOADS_PER_DAY_PER_USER: z.coerce.number().int().positive().default(20),

    FFMPEG_PATH: z.string().min(1).default("ffmpeg"),
    FFPROBE_PATH: z.string().min(1).default("ffprobe"),
    FFMPEG_THREADS: z.coerce.number().int().min(1).max(64).default(2),
    WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(1),
    FFMPEG_TIMEOUT_SECONDS: z.coerce.number().int().min(10).default(900),
    JOB_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
    WORKER_TMP_DIR: z.string().optional(),
    INFRA_COST_CENTS_PER_PROCESSING_MINUTE: optionalInt,

    BILLING_UNIT_SECONDS: z.coerce.number().int().positive().default(60),
    CREDITS_PER_UNIT: z.coerce.number().int().positive().default(1),
    BILLING_MIN_CREDITS: z.coerce.number().int().nonnegative().default(1),
    SIGNUP_BONUS_CREDITS: z.coerce.number().int().nonnegative().default(0),
    ENABLE_TEST_CREDITS: bool,
    TEST_CREDITS_AMOUNT: z.coerce.number().int().positive().max(10000).default(60),

    RETENTION_SOURCE_DAYS: z.coerce.number().int().positive().default(30),
    RETENTION_EXPORT_DAYS: z.coerce.number().int().positive().default(30),

    MAIL_DRIVER: z.enum(["console", "smtp"]).default("console"),
    MAIL_FROM: z.string().default("GM Sports Clips <nao-responda@example.com>"),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    SMTP_SECURE: bool,

    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  })
  .superRefine((env, ctx) => {
    if (env.STORAGE_DRIVER === "local" && !env.STORAGE_SIGNING_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["STORAGE_SIGNING_SECRET"],
        message: "Obrigatório quando STORAGE_DRIVER=local",
      });
    }
    if (env.STORAGE_DRIVER === "s3") {
      for (const key of ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const) {
        if (!env[key]) ctx.addIssue({ code: "custom", path: [key], message: "Obrigatório quando STORAGE_DRIVER=s3" });
      }
    }
    if (env.MAIL_DRIVER === "smtp" && !env.SMTP_HOST) {
      ctx.addIssue({ code: "custom", path: ["SMTP_HOST"], message: "Obrigatório quando MAIL_DRIVER=smtp" });
    }
    if (env.NODE_ENV === "production" && env.MAIL_DRIVER === "console") {
      ctx.addIssue({
        code: "custom",
        path: ["MAIL_DRIVER"],
        message: "Em produção configure MAIL_DRIVER=smtp (o modo console expõe links de recuperação no log)",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Configuração de ambiente inválida:\n${details}`);
  }
  cached = parsed.data;
  return cached;
}

/** Apenas para testes. */
export function resetEnvCache(): void {
  cached = null;
}
