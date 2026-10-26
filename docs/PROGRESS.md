# Progresso

Última atualização: 2026-10-26 (sessão 1).

## Resumo

O fluxo do critério de sucesso do MVP (seção 17 do briefing) **funciona ponta a ponta** e é verificado por um teste automatizado no navegador, contra o build de produção e o worker reais:
cadastro → login → projeto → upload → 3 lances → custo (1 crédito) → processamento → 3 MP4 com duração correta (erro < 0,15 s) + ZIP → saldo 60 → 59 com reserva/confirmação no extrato → outro usuário recebe 404 em páginas e downloads.

## Etapas

| Etapa | Status |
|---|---|
| 1. Inspeção e planejamento | ✅ Diretório vazio; arquitetura e plano documentados |
| 2. Fundação (projeto, TS, lint, banco, auth, layout, testes) | ✅ |
| 3. Projetos e vídeos (upload seguro, metadados, marcação) | ✅ (upload multipart pendente) |
| 4. Processamento real (fila, worker, FFmpeg, downloads, ZIP) | ✅ |
| 5. Créditos (carteira, livro-razão, reserva/confirmação/reembolso, idempotência) | ✅ |
| 6. Admin e preparação comercial | ✅ painel, métricas, ajustes, configurações, auditoria · ⏳ infraestrutura, pagamentos, jurídico |

## Testes (executados nesta sessão)

| Suíte | Resultado |
|---|---|
| Unitários (`tests/unit`, 6 arquivos) | 64/64 ✅ — timecode, validação de lances, cobrança, nomes, argumentos FFmpeg, URLs assinadas/path traversal |
| Integração (`tests/integration`, 7 arquivos, Postgres + Redis + FFmpeg reais) | 51/51 ✅ — autenticação (login, logout, sessão forjada, recuperação de senha), isolamento entre usuários, projetos/lances, upload (válido, MOV sem áudio, extensão, tamanho, arquivo falso, codec não suportado, tamanho divergente), créditos (reserva/confirmação/reembolso, duplicidade, concorrência, CHECK no banco, admin, webhook de pagamento repetido), processamento (cortes precisos, margens, modo rápido, idempotência, falha + reembolso, preço alterado, saldo insuficiente, pausa) |
| Driver S3 (contra servidor S3 simulado "moto") | 4/4 ✅ — upload por URL assinada, head, assinatura binária, **ffprobe lendo por URL assinada**, download com nome, exclusão por prefixo |
| E2E Playwright (build de produção + worker) | 5/5 ✅ — fluxo principal, isolamento, admin bloqueado, celular |
| `tsc`, `eslint`, `next build` | ✅ sem erros |

Total: 119 testes Vitest + 5 E2E.

## Limitações conhecidas / pendências

- **Docker não foi executado**: o ambiente desta sessão não permite rodar o daemon. `Dockerfile` e `docker-compose.yml` estão escritos, mas não testados. Os testes usaram PostgreSQL/Redis instalados localmente.
- **MinIO/S3 real não testado**: o driver S3 foi testado contra o simulador "moto", que não valida assinaturas. Validar com MinIO (docker compose) e com o provedor escolhido, incluindo CORS do bucket.
- Upload em um único PUT (limite padrão 2 GiB); multipart/resumível pendente.
- Sem provedor de pagamento (por decisão: nada de cobrança real sem autorização). Compra de créditos aparece como "ainda não disponível".
- E-mail: somente modo console testado; SMTP implementado mas não testado com provedor real.
- Rate limit de autenticação em memória (1 instância).
- Política de expiração de créditos e saldos promocionais separados: apenas preparados no modelo.
- Vídeo único com todos os lances (compilação): não implementado (opcional no briefing).
- Players do navegador podem não reproduzir HEVC (iPhone) em alguns navegadores: a interface avisa e o usuário digita os horários; o processamento funciona.
- HDR/10 bits é convertido para 8 bits no corte preciso (cores podem mudar).
- Termos e privacidade são rascunhos (ver SECURITY.md, pendências jurídicas).
- Custo real de infraestrutura não medido (precisa da infraestrutura escolhida).

## Próximo passo recomendado

1. **Conectar um repositório GitHub** para guardar o código (este ambiente é temporário).
2. Rodar `docker compose up --build` numa máquina com Docker e executar o checklist de homologação abaixo.
3. Decidir a hospedagem (DEPLOYMENT.md) → homologação → medir custo por minuto → definir preços.
4. Escolher o provedor de pagamento (Pix + cartão) e implementar o webhook.

## Checklist de homologação (manual)

- [ ] Cadastro com aceite de termos; e-mail de boas-vindas não é necessário
- [ ] Login / logout / senha errada (o e-mail permanece no campo)
- [ ] Recuperação de senha: e-mail chega, link funciona uma vez, sessões antigas caem
- [ ] Criar projeto com atleta, partida, data, margens e modo de corte
- [ ] Enviar vídeo real de celular (MP4 H.264) e de câmera (MOV); acompanhar barra de progresso
- [ ] Enviar arquivo inválido (PDF renomeado) → recusado com mensagem clara
- [ ] Editor: marcar lances pelo player (bandeiras) e digitando; prévia de cada lance; editar, reordenar, ordenar por tempo, excluir
- [ ] Tela de custo: valores corretos; saldo insuficiente bloqueia
- [ ] Processar 3 lances; sair da página e voltar; status atualiza sozinho
- [ ] Baixar cada lance e o ZIP; conferir nomes, duração, áudio e qualidade
- [ ] Extrato de créditos: reserva + consumo; saldo correto
- [ ] Forçar falha (ex.: parar o worker no meio e reiniciar) → job falha ou retoma; créditos devolvidos em falha
- [ ] Segundo usuário não acessa URLs do primeiro (projeto, processamento, downloads)
- [ ] Admin: métricas, usuários, ajuste de créditos com justificativa, configurações (pausar processamento), auditoria
- [ ] Celular: fluxo completo em Android e iPhone
- [ ] Exclusão de projeto e de conta remove os arquivos do bucket
- [ ] Retenção: reduzir `RETENTION_*_DAYS` para 1 e verificar a limpeza

## Histórico

- **Sessão 1 (2026-10-26):** planejamento, fundação, todo o MVP v1, testes e documentação.
