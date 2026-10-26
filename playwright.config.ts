import { defineConfig, devices } from "@playwright/test";

/**
 * Teste ponta a ponta do fluxo principal, contra o build de produção + worker reais.
 * Usa banco, armazenamento e prefixo de fila próprios (não mexe nos dados de desenvolvimento).
 * Pré-requisitos: PostgreSQL e Redis rodando, FFmpeg instalado e `pnpm build` executado.
 */
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export const e2eEnv = {
  DATABASE_URL: process.env.E2E_DATABASE_URL ?? "postgresql://gmclips:gmclips@localhost:5432/gm_clips_e2e",
  STORAGE_DRIVER: "local",
  STORAGE_LOCAL_DIR: "./.data/e2e-storage",
  REDIS_PREFIX: "gmclips-e2e",
  APP_URL: BASE_URL,
  BETTER_AUTH_URL: BASE_URL,
  ENABLE_TEST_CREDITS: "true",
  TEST_CREDITS_AMOUNT: "60",
  SIGNUP_BONUS_CREDITS: "0",
  LOG_LEVEL: "warn",
  NEXT_TELEMETRY_DISABLED: "1",
};

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "pt-BR",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, grepInvert: /@mobile/ },
    { name: "celular", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
  ],
  webServer: [
    {
      command: `pnpm exec next start -p ${PORT}`,
      url: `${BASE_URL}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: e2eEnv,
    },
    {
      command: "pnpm worker",
      // O worker não expõe HTTP: considera pronto quando registra a inicialização no log.
      wait: { stdout: /Worker iniciado/ },
      env: { ...e2eEnv, LOG_LEVEL: "info" },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
