# Arquitetura

## Visão geral

```
Navegador ──HTTPS──▶ Web (Next.js)  ──▶ PostgreSQL  (fonte da verdade: usuários, projetos, jobs, créditos)
   │                     │
   │                     └──▶ Redis/BullMQ (fila) ──▶ Worker (Node + FFmpeg) ──▶ PostgreSQL
   │                                                       │
   └──PUT/GET por URL assinada──▶ Armazenamento S3 ◀────────┘ (lê o original por HTTP Range, grava os cortes)
```

Dois processos com o mesmo código-fonte:

| Processo | Papel | Escala |
|---|---|---|
| **web** (`pnpm start`) | Páginas, Server Actions, rotas de upload/download, autenticação | Horizontal, leve (não processa vídeo) |
| **worker** (`pnpm worker`) | Análise (ffprobe) e corte (ffmpeg) dos vídeos, reconciliação e retenção | Horizontal, independente; CPU-intensivo |

O vídeo **nunca passa pelo servidor web** em produção: o navegador envia direto ao S3 com URL assinada, e o worker lê do S3 por URL assinada (o FFmpeg só baixa os trechos necessários via requisições Range).

## Estrutura de pastas

```
src/
  app/                 Rotas Next.js
    (marketing)/       Landing, termos, privacidade
    (auth)/            Entrar, cadastro, recuperar/redefinir senha
    (app)/             Área logada: painel, projetos, editor, processamentos, créditos, conta, admin
    actions/           Server Actions (formulários) — validam e chamam os serviços
    api/               Rotas HTTP: auth, uploads, downloads (individual e ZIP), status, storage local, health
  components/          UI reutilizável (padrão shadcn: cva + Tailwind)
  lib/                 Regras puras, sem I/O, usadas no cliente e no servidor
    timecode.ts        Conversão de horários (MM:SS, HH:MM:SS)
    clips.ts           Validação de intervalos, margens, categorias
    billing/pricing.ts Regra de cobrança (módulo isolado)
    naming.ts          Nomes de arquivo padronizados e seguros
  server/              Somente servidor
    env.ts             Variáveis de ambiente validadas (Zod)
    db.ts auth.ts      Prisma e Better Auth
    session.ts         Camada de acesso (requireUser/requireAdmin)
    storage/           Interface + drivers local (HMAC) e S3
    media/ffmpeg.ts    FFmpeg/ffprobe seguros (sem shell)
    queue/             Filas BullMQ
    services/          Regras de negócio: projects, media, clips, processing, credits, exports, account, admin
  generated/prisma/    Cliente Prisma (gerado; não versionado)
worker/                Processo do worker (processadores, reconciliação, retenção)
prisma/                Schema e migrações versionadas
tests/                 unit/, integration/ (banco real), e2e/ (Playwright), fixtures/
docs/                  Documentação
```

**Regra de ouro:** páginas e actions não falam com o banco para dados de usuário sem passar por `services/*`, e todo serviço recebe o `userId` do servidor e filtra por ele.

## Fluxo de processamento de vídeo

1. **Projeto** criado (nome, atleta, partida, modo de corte, margens).
2. **Upload** (`POST /api/uploads`): servidor valida extensão, tamanho, limite diário e propriedade do projeto; cria `MediaAsset` (`PENDING_UPLOAD`) com chave gerada pelo servidor e devolve URL assinada de PUT. O navegador envia o arquivo direto (com barra de progresso).
3. **Conclusão** (`POST /api/uploads/:id/complete`): servidor confere o tamanho real e a assinatura binária (ISO-BMFF `ftyp`/`moov`…); se ok → `UPLOADED` e agenda a análise. O vídeo anterior do projeto é removido.
4. **Análise (worker)**: `ffprobe` com demuxer forçado `mov` → valida contêiner, codec (H.264/H.265/MPEG-4), resolução e duração máxima → `READY` com metadados, ou `REJECTED` com motivo (e o arquivo é apagado).
5. **Marcação**: lances com início/fim (texto ou botões "tempo atual" no player), título, categoria, observações; validados no servidor contra a duração.
6. **Estimativa** (`planProcessing`): aplica margens, limita ao vídeo, calcula créditos pela regra vigente. A mesma função é usada na tela e no início do processamento.
7. **Início** (`startProcessing`), numa transação com lock da carteira:
   - idempotência por `(userId, idempotencyKey)` (chave gerada ao renderizar a confirmação);
   - limites de jobs ativos por usuário/projeto (+ índice único parcial no banco);
   - cria `ProcessingJob` (`QUEUED`) e um `Export` por lance (cópia dos tempos);
   - **reserva** os créditos (`PROCESSING_HOLD`, valor negativo).
   Depois do commit, enfileira no BullMQ com `jobId` = id do banco (sem duplicatas). Se a fila falhar, o job é marcado como falho e os créditos devolvidos na hora.
8. **Execução (worker)**: para cada `Export` pendente, `ffmpeg` corta para um arquivo temporário, `ffprobe` confere a saída, o arquivo vai para o S3 e o `Export` vira `DONE`. Lances já prontos não são refeitos em nova tentativa.
9. **Conclusão**: `SUCCEEDED` + **confirmação** do consumo (`PROCESSING_CAPTURE`) na mesma transação; registra tempo de processamento, bytes gerados e custo estimado (se a taxa estiver configurada).
10. **Falha**: até `JOB_MAX_ATTEMPTS` tentativas com backoff; na falha definitiva → `FAILED` + **reembolso** (`PROCESSING_REFUND`). Erros permanentes (ex.: original removido) não são re-tentados.
11. **Download**: `GET /api/downloads/export/:id` confere a posse e redireciona para URL assinada de 5 min com nome padronizado; `GET /api/downloads/job/:id` gera o ZIP em streaming (sem recompressão).
12. **Manutenção (worker, agendada)**: reconciliação a cada 2 min (banco × fila: re-enfileira jobs perdidos, falha+reembolsa jobs órfãos) e retenção a cada hora (apaga originais/cortes expirados e uploads abandonados).

### Corte preciso × corte rápido

| | Preciso (padrão) | Rápido |
|---|---|---|
| Como | Recodifica vídeo (H.264 `veryfast`, CRF 20) e áudio (AAC) | Copia o vídeo (`-c:v copy`), recodifica só o áudio |
| Precisão | Quadro exato (testado: erro < 0,15 s) | Início encaixa no keyframe anterior — pode começar vários segundos antes |
| Velocidade | Proporcional à duração do trecho e à resolução | Quase instantâneo |
| Qualidade | Visualmente equivalente; nova compressão | Idêntica ao original |
| Compatibilidade | MP4 H.264 + AAC, toca em qualquer lugar | Mantém o codec original (H.265 pode não tocar em todos os aparelhos) |

`-ss` antes de `-i` faz busca rápida e, com recodificação, mantém precisão de quadro. Rotação de celular é aplicada automaticamente na recodificação. HDR/10 bits é convertido para 8 bits (`yuv420p`), o que pode alterar cores de vídeos HDR — limitação conhecida.

## Créditos e cobrança

- Regra isolada em `src/lib/billing/pricing.ts` (pura, testada). Parâmetros: unidade (s), créditos por unidade, mínimo — padrão do `.env`, editáveis no admin.
- Cobra-se pelos **segundos processados** (soma dos lances com margens), não pela duração do jogo.
- Carteira = saldo + livro-razão imutável (`CreditTransaction`). Toda movimentação: lock da carteira → checa idempotência → lança → atualiza saldo. `CHECK (balance >= 0)` no banco.
- Ciclo: reserva → confirmação | reembolso (exclusivos; protegidos por lock da linha do job).
- Planos/assinaturas/pagamentos: tabelas e `grantCreditsForPayment` (idempotente) prontos; **nenhum provedor conectado**.

## Observabilidade e custos

- Logs JSON (pino) com `service` (web/worker) e `correlationId` = id do processamento; dados sensíveis redigidos.
- Métricas no painel admin: usuários, vídeos e minutos enviados, minutos processados, tempo médio por job, taxa de erro, bytes gerados, armazenamento em uso, créditos consumidos, custo estimado.
- `GET /api/health` verifica banco e Redis.

### Como calcular o custo real por minuto (pendente — depende da infraestrutura escolhida)

Não inventamos valores. Para chegar ao custo real:

1. **Computação**: rodar o worker na máquina escolhida e medir `processingMs` por minuto processado (`billableSeconds`) para vídeos reais (1080p H.264, 4K H.265 de celular). Custo/min = (preço/hora da máquina ÷ 60) × (minutos de parede por minuto processado) ÷ jobs simultâneos por máquina.
2. **Armazenamento**: `sizeBytes` médio dos originais × dias de retenção + cortes (`outputBytes`) × dias de retenção, × preço GB/mês do provedor.
3. **Transferência**: downloads (`outputBytes` × nº de downloads) + leitura do original pelo worker (quase zero se o worker estiver na mesma região/provedor; R2 não cobra saída).
4. Com isso, preencher `INFRA_COST_CENTS_PER_PROCESSING_MINUTE` (computação) e calcular a margem por plano: preço do crédito − (custo computação + armazenamento + transferência) por minuto.

## Extensões futuras previstas na arquitetura

- `MediaSource.EXTERNAL_IMPORT`: importação de fontes **autorizadas** via APIs oficiais (nunca download arbitrário de YouTube).
- `ExportKind`: adicionar `COMPILATION` (vídeo único com todos os lances) sem mudar o fluxo.
- Detecção automática: um novo tipo de job no worker que **sugere** `Clip`s (o usuário revisa), reaproveitando corte, cobrança e downloads.
- Upload multipart/resumível (ver DEPLOYMENT.md).
