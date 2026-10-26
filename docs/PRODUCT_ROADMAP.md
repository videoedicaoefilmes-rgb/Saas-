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
