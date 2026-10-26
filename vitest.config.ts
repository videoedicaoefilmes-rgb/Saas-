import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    setupFiles: ["tests/setup.ts"],
    // Testes de integração compartilham o banco de testes: execução sequencial.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
    server: { deps: { inline: [/server-only/] } },
  },
});
