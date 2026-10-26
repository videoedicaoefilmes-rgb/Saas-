# Registro de decisões técnicas

Formato: contexto → decisão → consequências. Data: 2026-10-26 salvo indicação.

### D1. Monólito modular Next.js + worker separado
Uma única base de código TypeScript; dois processos (web e worker). Evita microsserviços prematuros, mantém regras de negócio compartilhadas (`src/server/services`) e permite escalar o processamento separadamente.

### D2. Next.js 16 com `cacheComponents` desligado
O scaffold vem com Cache Components ligado, que exige `<Suspense>` em toda leitura de sessão. Quase todo o app é dinâmico e autenticado; o modelo clássico é mais simples de manter. Pode ser reativado página a página no futuro.

### D3. Better Auth para autenticação
Biblioteca consolidada, com e-mail/senha, recuperação de senha, sessões no banco e adaptador Prisma — sem depender de serviço pago (Auth0/Clerk). Lucia foi descontinuada; Auth.js tem suporte fraco a credenciais com sessão em banco.

### D4. Prisma 7 (estável) e PostgreSQL
Versão estável mais recente (a tag `latest` do npm apontava para uma RC da v8, evitada). Restrições que o Prisma não expressa (CHECK, índice único parcial) ficam em migração SQL.

### D5. BullMQ + Redis, com o banco como fonte da verdade
Fila madura, com tentativas, backoff, deduplicação por `jobId` e detecção de travamentos. O estado e a cobrança vivem no Postgres; a reconciliação periódica corrige divergências (Redis perdido, worker morto). Alternativa considerada: fila em Postgres (pg-boss) — menos peças, mas BullMQ foi o sugerido e é mais difundido.

### D6. Upload direto ao S3 com URL assinada
O vídeo não passa pelo servidor web (custo, memória, timeouts). Driver **local** emula URLs assinadas com HMAC, permitindo desenvolver e testar sem S3.

### D7. FFmpeg via `spawn` sem shell, demuxer forçado e whitelist de protocolos
Elimina injeção de comandos e leitura de arquivos/URLs arbitrários por mídias maliciosas.

### D8. Corte preciso (recodificação) como padrão
Para o público (pais e prestadores), cortar no ponto exato importa mais que segundos de processamento. Modo rápido disponível por projeto, com o trade-off explicado na interface.

### D9. Cobrança por segundos processados, regra pura isolada
Mais justa (não cobra o jogo inteiro) e previsível. `pricing.ts` sem I/O, com `pricingSnapshot` gravado em cada job para auditoria. Nenhum preço em R$ definido.

### D10. Reserva → confirmação/reembolso
Créditos debitados ao iniciar (evita gastar o mesmo saldo duas vezes) e devolvidos automaticamente em falha definitiva. Idempotência por chave única em cada lançamento e lock da carteira.

### D11. Componentes no padrão shadcn escritos à mão
O registro do shadcn/ui estava inacessível no ambiente de desenvolvimento. Os componentes seguem o mesmo padrão (cva + tailwind-merge) sem Radix; diálogos usam `confirm()`/HTML nativo. Pode-se migrar para o CLI do shadcn depois sem mudar as telas.

### D12. Um vídeo por projeto
Simplifica a UX e o modelo ("um projeto = uma partida"). Novo envio substitui o anterior. Projetos com vários vídeos podem vir depois.

### D13. Respostas 404 reais para recursos de terceiros
`loading.tsx` só nas listagens: com streaming, o status 200 é enviado antes da checagem de acesso. Páginas de detalhe não têm esqueleto de carregamento para responder 404 corretamente.

### D14. Sem download de YouTube/links públicos
Link público não concede direito de baixar/armazenar. Há o valor `MediaSource.EXTERNAL_IMPORT` reservado para integrações oficiais e autorizadas, a serem avaliadas caso a caso.

### D15. ZIP gerado em streaming (client-zip), sem compressão
MP4 já é comprimido; streaming evita arquivo temporário e memória. Custo: o tráfego do ZIP passa pelo servidor web (os downloads individuais vão direto ao S3).
