# Roadmap do produto

## MVP v1 — corte manual (este código)
Conta → projeto → upload → marcação manual → custo em créditos → processamento FFmpeg → downloads (individual e ZIP) → admin.
**Status:** implementado e testado ponta a ponta localmente. Falta infraestrutura real e revisão jurídica (ver PROGRESS.md).

## v1.1 — Pronto para cobrar (próximas etapas)
1. Deploy de homologação (após escolha da infraestrutura — ver DEPLOYMENT.md).
2. Medir custo real por minuto processado → definir preços dos pacotes/planos.
3. Provedor de pagamento brasileiro (Pix + cartão; candidatos: Mercado Pago, Asaas, Pagar.me, Stripe BR) com webhooks verificados, usando `Payment`/`WebhookEvent`/`grantCreditsForPayment` já prontos.
4. Assinatura mensal com créditos incluídos e renovação; política de expiração de créditos.
5. Verificação de e-mail, 2FA para admins, SMTP transacional.
6. Termos e privacidade revisados por advogado.

## v1.2 — Produtividade para prestadores
- Vídeo único com todos os lances (compilação, com transições simples e vinheta/marca d'água opcional).
- Upload multipart/resumível para arquivos grandes; vários vídeos por projeto (1º e 2º tempo).
- Marcação mais rápida: atalhos de teclado no player, "marcar lance" com duração padrão, importação de lista de horários (colar texto/CSV).
- Processamento em lote; duplicar projeto; pastas por cliente/atleta.
- Notificação por e-mail quando o processamento terminar.

## v1.5 — Sugestão automática de lances do atleta (PRIORIDADE definida pelo fundador em 27/10/2026)

Decisão do fundador após testar o MVP: o produto precisa identificar o atleta e sugerir **todos os lances em que ele toca na bola**, para **qualquer posição** (não só goleiro).

Fluxo proposto ("sugere e o usuário confere"):
1. Usuário informa cor da camisa e número e clica no atleta em um quadro (pode clicar de novo se o rastreamento se perder).
2. Worker rastreia atleta e bola; momentos de contato viram lances candidatos (toques próximos agrupados, com margem).
3. Sugestões aparecem no editor de lances para aprovar/descartar; corte, cobrança e downloads reaproveitam o MVP.

Regras definidas pelo fundador (27/10/2026):
- **Saída = só os recortes** dos toques na bola; nenhuma marcação visual (seta/círculo/destaque) sobre o atleta no vídeo gerado. A identificação do atleta (cor, número, clique) é apenas entrada para o sistema.
- **Prioridade: não perder toques (recall alto).** Na dúvida, incluir o lance; alguns cortes a mais onde o atleta só estava perto são aceitáveis. Meta de avaliação: maximizar toques encontrados, mantendo as sugestões erradas num nível que a revisão manual absorva.

Antes de construir: **teste de precisão** com 2–3 vídeos reais (pasta "Teste atleta" no Google Drive do fundador) e lista de toques marcada à mão como gabarito. Medir acertos, toques perdidos e sugestões erradas por tipo de filmagem (celular no nível do campo, celular na arquibancada, câmera fixa, vídeo editado). Comparar processamento próprio (modelos abertos) × API de visão de terceiros (custo e privacidade — vídeos com menores).

Tipos de filmagem recebidos: celular na arquibancada, **celular no nível do campo** (caso mais difícil), câmera fixa de campo inteiro, transmissão/vídeo editado.

## v2 — Assistência automática (pesquisa, sem promessas)
Cada item exige protótipo e avaliação de precisão com vídeos reais antes de virar funcionalidade:
- Detecção de eventos (gol, finalização) por áudio/visão para **sugerir** lances que o usuário revisa.
- Rastreamento de atleta e leitura de número de camisa — problema difícil (oclusão, resolução, câmera distante); exigirá modelos e GPU, com custo a medir.
- Organização de lances por jogador.

## v3 — Plataforma
- API e integrações para empresas de filmagem; webhooks.
- Importação de fontes autorizadas por APIs oficiais.
- Outras modalidades esportivas.
- Integração com o ecossistema GM Sports (cursos Prepara o Lance, comunidade).

## Fora de escopo por decisão
Download arbitrário de YouTube, apps nativos, marketplace, rede social, editor profissional completo, afiliados.
