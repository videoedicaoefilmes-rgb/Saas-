-- Restrições de integridade que o schema Prisma não expressa.
-- Defesa em profundidade: o código já valida, mas o banco garante.

-- Saldo de créditos nunca negativo.
ALTER TABLE "credit_wallets" ADD CONSTRAINT "credit_wallets_balance_non_negative" CHECK ("balance" >= 0);

-- Lances: início >= 0 e fim > início.
ALTER TABLE "clips" ADD CONSTRAINT "clips_valid_range" CHECK ("startMs" >= 0 AND "endMs" > "startMs");
ALTER TABLE "exports" ADD CONSTRAINT "exports_valid_range" CHECK ("startMs" >= 0 AND "endMs" > "startMs");

-- Processamentos: créditos e contadores não negativos.
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_non_negative" CHECK ("creditsCharged" >= 0 AND "clipCount" > 0 AND "billableSeconds" > 0);

-- No máximo um processamento ativo (na fila ou executando) por projeto.
CREATE UNIQUE INDEX "processing_jobs_one_active_per_project"
  ON "processing_jobs" ("projectId")
  WHERE "status" IN ('QUEUED', 'RUNNING');
