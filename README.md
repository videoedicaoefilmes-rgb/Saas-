# GM Sports Clips

SaaS da GM Sports para cortar e organizar lances de partidas esportivas.
**MVP v1:** o usuário envia o vídeo da partida, marca os intervalos dos lances e recebe cada trecho cortado em MP4, pronto para baixar (individualmente ou em ZIP), pagando em créditos por minuto processado.

> Nome provisório — altere com a variável `APP_NAME`.

Não há inteligência artificial nesta fase: a marcação dos lances é manual. Veja o [roadmap](docs/PRODUCT_ROADMAP.md).

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · PostgreSQL 16 + Prisma 7 · Better Auth · Redis + BullMQ · FFmpeg · armazenamento compatível com S3 · Vitest + Playwright.
Detalhes e justificativas em [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) e [docs/DECISIONS.md](docs/DECISIONS.md).

## Requisitos

- Node.js 22+ e pnpm 10+
- PostgreSQL 16+ e Redis 7+
- FFmpeg 6+ (com `libx264` e `aac`) no PATH
- Opcional: Docker (sobe tudo com `docker compose up --build`)

## Como rodar (sem Docker)

```bash
pnpm install                        # também gera o cliente Prisma
cp .env.example .env                # e troque os segredos (openssl rand -base64 32)
pnpm db:deploy                      # aplica as migrações
pnpm dev                            # aplicação web em http://localhost:3000
pnpm worker:dev                     # em outro terminal: worker de processamento
```

Com `STORAGE_DRIVER=local` (padrão), os vídeos ficam em `./.data/storage` — ótimo para desenvolvimento, sem precisar de S3.
Com `MAIL_DRIVER=console`, o e-mail de recuperação de senha é impresso no terminal do `pnpm dev`.

### Primeiro administrador

```bash
# cadastre-se pela aplicação e então:
pnpm admin:promote seu@email.com
```

### Créditos de teste

Com `ENABLE_TEST_CREDITS=true`, a página **Créditos** tem um botão para adicionar créditos sem valor comercial (até 5 vezes por dia). O administrador também pode ajustar créditos com justificativa. **Nenhuma cobrança real está ativa.**

## Com Docker

```bash
cp .env.example .env   # troque os segredos
docker compose up --build
```

Sobe PostgreSQL, Redis, SeaweedFS (armazenamento S3 local, bucket privado), migrações, web (porta 3000) e worker (com limite de CPU/memória).
Validado em 2026-10-26 (ver docs/PROGRESS.md para o estado do teste completo nesta instalação).

Não é programador? Veja o passo a passo em [docs/GUIA_DOCKER.md](docs/GUIA_DOCKER.md).

## Testes

```bash
pnpm test              # unitários + integração (usa .env.test, banco gm_clips_test, Redis e FFmpeg reais)
pnpm build && pnpm test:e2e   # fluxo completo no navegador (banco gm_clips_e2e)
S3_TEST_ENDPOINT=http://localhost:8333 S3_TEST_KEY=gmclips-local S3_TEST_SECRET=gmclips-local-secret pnpm test tests/integration/storage-s3.test.ts
```

Crie os bancos de teste uma vez: `createdb gm_clips_test` e `createdb gm_clips_e2e` (mesmo usuário do `.env.test`).
Os vídeos de teste são gerados automaticamente pelo FFmpeg (barras de cor + tom, sem pessoas).

## Comandos

| Comando | O que faz |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Aplicação web |
| `pnpm worker` / `pnpm worker:dev` | Worker de processamento (FFmpeg) |
| `pnpm db:migrate` | Cria nova migração (desenvolvimento) |
| `pnpm db:deploy` | Aplica migrações (produção/CI) |
| `pnpm admin:promote <email>` | Torna um usuário administrador |
| `pnpm lint` / `pnpm typecheck` | Qualidade |
| `pnpm test` / `pnpm test:e2e` | Testes |

## Documentação

- [Arquitetura](docs/ARCHITECTURE.md) · [Banco de dados](docs/DATABASE.md) · [Segurança](docs/SECURITY.md)
- [Deploy](docs/DEPLOYMENT.md) · [Decisões](docs/DECISIONS.md) · [Roadmap](docs/PRODUCT_ROADMAP.md)
- [Progresso e checklist de homologação](docs/PROGRESS.md)
- [CLAUDE.md](CLAUDE.md) — contexto para sessões futuras do Claude Code
