# Segurança e privacidade

O produto trata vídeos que frequentemente mostram **crianças e adolescentes**. Segurança é requisito, não acessório.

> ⚖️ Implementação técnica não garante conformidade jurídica. Veja "Pendências que exigem revisão jurídica" no fim.

## Controles implementados (e testados)

### Autenticação e sessão
- Better Auth: e-mail + senha, hash scrypt, sessões no banco com cookie `httpOnly`, `SameSite=Lax`, `Secure` em produção, validade de 7 dias.
- Redefinição de senha por token de 1 h; **todas as sessões são revogadas** ao redefinir. Troca de senha revoga as outras sessões.
- Pedido de redefinição não revela se o e-mail existe.
- Limite de tentativas (produção): login 5/min, cadastro 5/5 min, recuperação 3/5 min por IP. Armazenamento em memória — **com várias instâncias web, trocar para banco/Redis**.
- O papel (`role`) não pode ser definido pelo cadastro (testado) e é relido do banco a cada requisição.
- Telemetria do Better Auth e do Next.js desativadas.

### Autorização / isolamento (anti-IDOR)
- Toda leitura/escrita passa por `src/server/services/*` filtrando por `userId` vindo da sessão no servidor.
- Recurso de outro usuário responde **exatamente como inexistente** (404), sem revelar existência.
- Testes: `tests/integration/isolation.test.ts` (todas as operações de projeto, lance, vídeo, job e download) e E2E com segundo usuário real.
- `/admin` exige `ADMIN` no layout e em cada Server Action admin; usuário comum recebe 404.
- O `proxy.ts` só redireciona visitantes sem cookie; **não** é a barreira de segurança.

### Upload
- Extensão permitida (mp4/mov/m4v) e tamanho máximo checados antes de emitir a URL.
- URL de upload assinada, com tamanho exato assinado (S3) ou verificado byte a byte (driver local), validade de 1 h.
- Após o envio: tamanho real conferido, **assinatura binária** conferida (texto renomeado para .mp4 é rejeitado), depois `ffprobe` valida contêiner, codec, resolução e duração.
- Arquivos rejeitados são apagados imediatamente.
- Limite de uploads por usuário/24 h; limite de jobs ativos por usuário; 1 job ativo por projeto; pausa de emergência de uploads/processamentos no admin.
- Declaração obrigatória de autorização de uso das imagens (gravada em `rightsConfirmedAt`).

### Arquivos e armazenamento
- Bucket **privado**; nenhum arquivo público. Download somente por URL assinada de curta duração (5 min) emitida após checar a posse.
- Chaves de armazenamento compostas **somente por IDs gerados pelo servidor** (`users/{id}/projects/{id}/...`), validadas por regex; o driver local ainda confere que o caminho resolvido fica dentro da raiz (**path traversal** testado).
- Nomes originais só para exibição, sanitizados; nomes de download gerados a partir de slugs.
- Tokens do driver local: HMAC-SHA256 com comparação em tempo constante, operação (get/put) e expiração assinadas.

### FFmpeg
- `spawn(binário, [args])` **sem shell**; nenhum texto do usuário vira argumento (tempos são inteiros validados; caminhos/URLs gerados pelo servidor).
- Demuxer forçado (`-f mov`) e `-protocol_whitelist` restrito (`file` OU `https,http,tls,tcp`): impede que arquivos maliciosos (playlists HLS/concat disfarçadas) façam o FFmpeg ler outros arquivos ou URLs.
- Tempo máximo por processo (SIGKILL), saída de stderr limitada, diretório temporário exclusivo por job e removido ao final.
- Isolamento de recursos: no Docker, limite de CPU/memória/tmpfs do contêiner do worker; `FFMPEG_THREADS` e `WORKER_CONCURRENCY`.

### Web
- Server Actions com checagem de origem do Next; rotas `POST` próprias exigem `Origin` da aplicação (CSRF).
- Cabeçalhos: CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`. `poweredByHeader` desligado.
- Redirecionamento pós-login só para caminhos internos (sem open redirect).
- Entradas validadas com Zod no servidor; mensagens de erro genéricas para erros inesperados.

### Dados e logs
- Segredos somente em variáveis de ambiente; `.env` fora do git; validação na inicialização (falha cedo).
- `MAIL_DRIVER=console` é bloqueado em produção (exceto em `localhost`).
- Logs identificam usuários por ID; redação automática de `password`, `token`, `url`, `email`, cookies. URLs assinadas nunca são registradas.
- Retenção automática: originais e cortes expiram (padrão 30 dias, configurável); uploads abandonados removidos em 24 h.
- Exclusão de projeto remove arquivos; exclusão de conta (com senha + "EXCLUIR") remove todos os arquivos (`users/{id}/`) e dados em cascata, mantendo só um registro de auditoria sem dados pessoais.
- Registro de aceite de termos com versão (`TERMS_VERSION`).
- Livro-razão de créditos imutável; ajustes administrativos exigem justificativa e geram auditoria.

## Riscos pendentes / limitações conhecidas

| Risco | Situação / mitigação sugerida |
|---|---|
| Rate limit em memória | Ok para 1 instância; usar `storage: "database"` ou Redis ao escalar |
| Upload único (PUT) até 5 GB no S3 | Implementar multipart/resumível antes de aceitar arquivos muito grandes |
| URL assinada é "portador" | Quem tiver o link baixa até expirar (5 min). Aceitável; reduzir TTL se necessário |
| Sem verificação de e-mail | Habilitar `requireEmailVerification` quando houver SMTP configurado |
| Sem 2FA para administradores | Adicionar plugin `twoFactor` do Better Auth antes de produção |
| CSP com `'unsafe-inline'` | Migrar para nonces quando estabilizar |
| FFmpeg não roda em sandbox de kernel (seccomp/gVisor) | Hoje: contêiner sem privilégios + limites. Para alto volume, considerar gVisor/Firecracker |
| Vulnerabilidades de FFmpeg | Manter a imagem atualizada (Debian security) |
| Antivírus nos uploads | Não implementado (arquivos só são lidos pelo FFmpeg com demuxer restrito) |
| Ajuste de admin sem dupla aprovação | Auditoria existe; considerar aprovação dupla para valores altos |
| Exclusão de conta apaga registros financeiros | Rever antes de cobrar (obrigações fiscais podem exigir retenção) |

## Pendências que exigem revisão jurídica (antes da operação comercial)

1. Termos de Uso e Política de Privacidade (hoje rascunhos marcados como tal).
2. Base legal (LGPD) para tratamento de imagens de crianças e adolescentes (art. 14: melhor interesse e consentimento específico de um dos pais/responsável) — o produto hoje coleta apenas uma **declaração** do usuário.
3. Papel da GM Sports (controladora × operadora) quando o usuário é um prestador de serviço que envia vídeos de terceiros; necessidade de contrato de operação de dados para clientes B2B.
4. Nomeação de encarregado (DPO) e canal de atendimento a titulares.
5. Prazos de retenção de vídeos, de dados de conta e de registros financeiros.
6. Política de reembolso e validade de créditos pagos (Código de Defesa do Consumidor, direito de arrependimento).
7. Localização dos dados (provedor/região) e transferência internacional.
8. Direitos autorais/de imagem sobre transmissões e gravações de terceiros; procedimento de remoção (notice and takedown).
