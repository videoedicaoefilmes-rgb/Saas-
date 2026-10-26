# Banco de dados

PostgreSQL 16, Prisma 7. Schema: `prisma/schema.prisma`. Migrações versionadas em `prisma/migrations/` (`pnpm db:migrate` em dev, `pnpm db:deploy` em produção).

## Entidades

```
User ─┬─ Session, Account            (Better Auth; senha com hash em Account.password)
      ├─ CreditWallet ── CreditTransaction (livro-razão)
      ├─ Project ─┬─ MediaAsset      (vídeo original; 1 ativo por projeto)
      │           ├─ Clip            (lances marcados)
      │           └─ ProcessingJob ── Export (1 arquivo por lance)
      ├─ Subscription, Payment ── Plan  (preparado, sem uso no MVP)
      └─ AuditLog
Verification (tokens de redefinição de senha), WebhookEvent, AppSetting
```

| Tabela | Descrição | Pontos importantes |
|---|---|---|
| `users` | Conta | `role` (USER/ADMIN), `termsAcceptedAt` + `termsVersion` (registro de consentimento) |
| `sessions`, `accounts`, `verifications` | Autenticação | Gerenciadas pelo Better Auth |
| `projects` | Uma partida/atleta | `cutMode`, margens em ms |
| `media_assets` | Vídeo enviado | `status` (PENDING_UPLOAD → UPLOADED → PROBING → READY/REJECTED → DELETED), metadados do ffprobe, `rightsConfirmedAt`, `expiresAt` (retenção), `source` (UPLOAD; EXTERNAL_IMPORT reservado) |
| `clips` | Lance marcado | `startMs`/`endMs` (CHECK: início ≥ 0, fim > início), `position`, categoria |
| `processing_jobs` | Um processamento | `status` (QUEUED/RUNNING/SUCCEEDED/FAILED/CANCELED), `creditStatus` (HELD/CAPTURED/REFUNDED), `idempotencyKey` único por usuário, `pricingSnapshot`, métricas (`processingMs`, `outputBytes`, `estimatedCostCents`) |
| `exports` | Arquivo gerado | Cópia dos tempos/título do lance (edições posteriores não afetam), `filename` padronizado, `storageKey` único |
| `credit_wallets` | Saldo | CHECK `balance >= 0` |
| `credit_transactions` | Movimentação | `amount` com sinal, `balanceAfter`, `idempotencyKey` **única**, `actorUserId` (admin), `jobId`/`paymentId` |
| `plans`, `subscriptions`, `payments` | Monetização | Valores em centavos; `(provider, providerPaymentId)` único; `creditsGrantedAt` impede concessão dupla |
| `webhook_events` | Webhooks recebidos | `(provider, eventId)` único |
| `audit_logs` | Auditoria | Ajustes de crédito, configurações, exclusões, aceite de termos, promoção a admin |
| `app_settings` | Configurações do admin | chave → JSON, validado por Zod ao ler |

## Integridade e idempotência

- Chaves estrangeiras explícitas; exclusão de usuário/projeto em cascata; `Export.clipId` vira `NULL` se o lance for removido.
- **Restrições extras** (migração `db_constraints`):
  - `credit_wallets.balance >= 0`
  - intervalos válidos em `clips` e `exports`
  - `processing_jobs_one_active_per_project`: índice único parcial — no máximo um job `QUEUED`/`RUNNING` por projeto.
- **Movimentações de crédito** sempre em transação com `SELECT ... FOR UPDATE` na carteira; a checagem de idempotência ocorre depois do lock.
- **Confirmar/reembolsar** trava a linha do job e só age se `creditStatus = HELD` (nunca os dois).
- O saldo da carteira é sempre igual à soma do livro-razão (testado).

## Índices

Listagens por usuário/projeto ordenadas por data (`(userId, createdAt)`, `(projectId, createdAt)`), filas administrativas (`(status, createdAt)`), retenção (`(status, expiresAt)`), lances por posição, auditoria por ator/alvo/ação.

## Observações

- IDs: `cuid` (Prisma) ou UUID sem hífens gerado pelo servidor quando o ID é necessário antes do insert (compor a chave do arquivo).
- `BigInt` para tamanhos de arquivo.
- Política de expiração de créditos: campo `expiresAt` reservado em `credit_transactions`; **ainda não aplicada**.
- Créditos promocionais separados dos comprados: não implementado (o `type` da transação já distingue a origem; separar saldos por "lote" exigirá uma tabela `CreditLot`).
