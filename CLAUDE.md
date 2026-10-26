# CLAUDE.md — contexto para sessões futuras

@AGENTS.md

## O produto
**GM Sports Clips** (nome provisório, `APP_NAME`): SaaS da GM Sports para cortar lances de partidas (futebol de base). Público: pais/atletas e, prioritariamente, prestadores de serviço (videomakers, empresas de filmagem).
MVP v1 = upload → marcação **manual** de intervalos → cortes FFmpeg → download (individual/ZIP), pago com créditos por minuto processado. Sem IA nesta fase.

## Regras do fundador (não negociáveis)
- Interface, docs para o fundador e mensagens em **português brasileiro**; código pode ser em inglês.
- Não inventar funcionalidades, dados, preços ou custos. Nada de botões sem ação nem "IA" fake.
- **Pedir confirmação antes de**: contratar serviços pagos, criar recursos com custo recorrente, ativar cobrança real, deploy público, comandos destrutivos, apagar dados, mudar configurações sensíveis de segurança, escolhas com impacto financeiro.
- Nunca implementar download de YouTube/plataformas sem API oficial e autorização.
- Não declarar algo como funcionando/testado sem executar. Atualizar `docs/PROGRESS.md` ao fim de cada etapa.
- Vídeos podem conter menores: privacidade e isolamento entre usuários são requisitos.

## Stack
Next.js 16 App Router (`cacheComponents` **desligado**; `proxy.ts` em vez de middleware; `params`/`searchParams` são Promises) · TS estrito · Tailwind 4 · componentes estilo shadcn escritos à mão em `src/components/ui` · Prisma 7 (cliente em `src/generated/prisma`, import de `@/generated/prisma/client`; config em `prisma.config.ts`) · PostgreSQL · Better Auth · BullMQ/Redis · FFmpeg · S3/local storage · Zod 4 · Vitest · Playwright.
Antes de usar APIs do Next, consulte `node_modules/next/dist/docs/`.

## Arquitetura em uma frase
Páginas/Server Actions/rotas → `src/server/services/*` (sempre com `userId` da sessão) → Prisma; processamento pesado no `worker/` via BullMQ; o **Postgres é a fonte da verdade** (a fila é só transporte; `worker/maintenance.ts` reconcilia).

## Invariantes que não podem quebrar
1. Todo acesso a dados de usuário filtra por `userId` no servidor; recurso alheio → `notFound()` (mesma resposta de inexistente).
2. Créditos: só via `postCreditTransaction` (lock da carteira + chave de idempotência única). Reserva → confirmação **ou** reembolso, nunca ambos. Saldo nunca negativo.
3. Preço calculado só no servidor (`planProcessing` → `src/lib/billing/pricing.ts`); o cliente envia o valor esperado apenas para detectar mudança.
4. Chaves de armazenamento só com IDs do servidor (`src/server/storage/keys.ts`). Nada de nome de arquivo do usuário em caminhos.
5. FFmpeg só via `src/server/media/ffmpeg.ts` (`spawn` sem shell, `-f mov`, `-protocol_whitelist`).
6. Páginas de detalhe sem `loading.tsx` no mesmo segmento (para responder 404 real).
7. Formulários: em erro, devolver campos não sensíveis com `withFields` (o React 19 limpa o form).

## Comandos
```bash
pnpm dev | pnpm worker:dev            # desenvolvimento (Postgres + Redis + FFmpeg locais)
pnpm test                              # 119 testes (usa .env.test, banco gm_clips_test)
pnpm build && pnpm test:e2e            # E2E (banco gm_clips_e2e, porta 3100)
pnpm lint && pnpm typecheck
pnpm db:migrate --name <nome>          # nova migração (e `pnpm db:generate`)
pnpm admin:promote <email>
```
Após criar páginas novas, rode `npx next typegen` para os tipos `PageProps<"/rota">`.

## Onde está o quê
- Plano/estado: `docs/PROGRESS.md` (comece por aqui) · Decisões: `docs/DECISIONS.md`
- Fluxo de vídeo e custos: `docs/ARCHITECTURE.md` · Modelo: `docs/DATABASE.md` · Riscos: `docs/SECURITY.md`

## Próximos passos (ver PROGRESS.md)
Repositório GitHub → testar docker compose/MinIO → escolher infraestrutura (com aprovação) → medir custo → pagamentos (Pix/cartão, com aprovação) → multipart → compilação em vídeo único.
