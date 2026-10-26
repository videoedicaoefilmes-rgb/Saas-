# Deploy e infraestrutura

> Nenhum recurso pago foi contratado e nenhum deploy público foi feito. As opções abaixo são **propostas** — a escolha tem impacto financeiro e precisa da aprovação do fundador.

## Componentes necessários

| Componente | Requisito | Observação |
|---|---|---|
| Web (Next.js) | Node 22, ~512 MB RAM | Sem processamento de vídeo; escala horizontal |
| Worker | Node 22 + FFmpeg, 2+ vCPU, 2+ GB RAM, disco temporário ≥ 2× maior corte | CPU é o gargalo; escalar por número de workers |
| PostgreSQL 16 | Gerenciado de preferência (backups, PITR) | |
| Redis 7 | `maxmemory-policy noeviction`, persistência AOF | Usado só pela fila |
| Armazenamento S3 | Bucket privado + CORS para o domínio do app | R2, S3, B2 (local: SeaweedFS) |
| SMTP | Para recuperação de senha | Qualquer provedor transacional |

A imagem Docker (`Dockerfile`) serve web e worker; o comando define o papel. Rode `pnpm db:deploy` (migrações) antes de subir novas versões.

## Opções de hospedagem (para decisão)

1. **Simples (1 VPS + serviços gerenciados)** — uma VM com Docker Compose rodando web + worker; Postgres e Redis gerenciados ou na mesma VM no início; armazenamento em Cloudflare R2 (sem custo de saída). Menor custo e complexidade; ponto único de falha.
2. **Plataforma de contêineres** (Fly.io, Railway, Render, Google Cloud Run + worker em VM) — web gerenciado e worker como serviço separado; Postgres/Redis gerenciados. Mais fácil de escalar o worker.
3. **AWS completa** (ECS/Fargate + RDS + ElastiCache + S3) — mais robusta e cara; faz sentido com volume.

Recomendação para o início: **opção 1 ou 2 com R2**, região próxima ao Brasil (ex.: São Paulo quando disponível), medindo custo real antes de definir preços.

## Configuração do bucket S3

- Bloquear todo acesso público.
- CORS (upload direto do navegador):
  ```json
  [{ "AllowedOrigins": ["https://seu-dominio"], "AllowedMethods": ["PUT", "GET"], "AllowedHeaders": ["content-type"], "MaxAgeSeconds": 3600 }]
  ```
- Regra de ciclo de vida opcional como rede de segurança (ex.: apagar objetos com mais de 45 dias) — a retenção principal é feita pelo worker.
- Variáveis: `STORAGE_DRIVER=s3`, `S3_ENDPOINT` (interno), `S3_PUBLIC_ENDPOINT` (se o navegador usa outro endereço), `S3_BUCKET`, credenciais com permissão apenas para esse bucket.

## Checklist de produção

- [ ] Segredos novos (`BETTER_AUTH_SECRET`, credenciais S3/SMTP) no gerenciador de segredos da plataforma
- [ ] `APP_URL`/`BETTER_AUTH_URL` com HTTPS; `NODE_ENV=production`
- [ ] `MAIL_DRIVER=smtp` configurado e testado
- [ ] `ENABLE_TEST_CREDITS=false` (e desligar no admin)
- [ ] Backups automáticos do Postgres e teste de restauração
- [ ] Redis com persistência
- [ ] Healthcheck em `/api/health`; alerta de taxa de erro e fila parada
- [ ] Coleta de logs JSON (stdout) em um agregador
- [ ] Termos/privacidade revisados por advogado e `TERMS_VERSION` atualizado
- [ ] Primeiro admin promovido (`pnpm admin:promote`)

## Arquivos grandes (ampliar limites)

Limite padrão: **2 GiB** e **3 h** de vídeo (`UPLOAD_MAX_BYTES`, `UPLOAD_MAX_DURATION_SECONDS`). Para ampliar:

1. Até ~5 GB: basta aumentar `UPLOAD_MAX_BYTES` (limite de um PUT único no S3). Conexões instáveis podem falhar no meio — o usuário recomeça.
2. Acima disso, ou para retomar uploads: implementar **multipart** — `CreateMultipartUpload` no servidor, URLs assinadas por parte (ex.: 16 MB), envio paralelo no navegador com retomada por parte, `CompleteMultipartUpload` no fim. A interface `StorageDriver` foi pensada para receber esses métodos; o restante do fluxo (complete → probe) não muda.
3. Ajustar `FFMPEG_TIMEOUT_SECONDS` e o disco temporário do worker para cortes longos em 4K.

## Escalando o processamento

- Mais throughput: mais réplicas do worker (cada uma com `WORKER_CONCURRENCY` jobs × `FFMPEG_THREADS`). Regra prática: `WORKER_CONCURRENCY × FFMPEG_THREADS ≈ vCPUs`.
- Jobs são distribuídos pelo BullMQ; o banco garante estado e cobrança corretos mesmo com várias réplicas.
- A reconciliação roda em todas as réplicas (idempotente).
