# Guia: rodar o GM Sports Clips no seu computador (sem saber programar)

Este guia liga o sistema completo **no seu próprio computador**, só para você testar. Nada fica na internet, nada é cobrado e ninguém além de você acessa.

Tempo estimado: 20 a 40 minutos na primeira vez (a maior parte é esperar downloads).

---

## Antes de começar: o que é cada coisa

| Nome | O que é, em palavras simples |
|---|---|
| **Docker** | Um programa que funciona como uma "caixa" onde o sistema roda. Em vez de instalar banco de dados, servidor e tudo mais, você instala só o Docker, e ele monta o resto sozinho. |
| **Docker Desktop** | A versão do Docker com janela, para Windows e Mac. |
| **Terminal** | Uma janela onde você digita comandos em texto. No Windows chama-se **PowerShell**; no Mac, **Terminal**. |
| **Comando** | Uma linha de texto que você copia, cola no terminal e aperta **Enter**. |
| **Pasta do projeto** | A pasta com o código do sistema, que você vai baixar do GitHub. |
| **`.env`** | Um arquivo de configurações (senhas e opções). Você vai criar uma cópia a partir de um modelo. |
| **localhost** | Significa "este computador". `http://localhost:3000` é o endereço do sistema rodando na sua máquina. |

---

## Passo 1 — Instalar o Docker Desktop

1. Acesse https://www.docker.com/products/docker-desktop/
2. Clique em **Download** para o seu sistema (Windows ou Mac — no Mac, escolha "Apple Silicon" se o seu for M1/M2/M3/M4, ou "Intel" se for mais antigo).
3. Instale como qualquer programa (avançar, avançar, concluir). No Windows, ele pode pedir para reiniciar o computador e para instalar o "WSL" — aceite.
4. Abra o **Docker Desktop**. Espere até aparecer, no canto inferior esquerdo, algo como **"Engine running"** (motor rodando) com uma bolinha verde.

> Requisitos: pelo menos 8 GB de memória RAM e uns 10 GB livres no disco.

## Passo 2 — Baixar o código do GitHub

1. Entre em https://github.com/videoedicaoefilmes-rgb/Saas- (com a sua conta, pois o repositório é privado).
2. Clique no botão verde **`<> Code`** e depois em **Download ZIP**.
3. Descompacte o arquivo (clique com o botão direito → **Extrair tudo** no Windows, ou dois cliques no Mac).
4. Você terá uma pasta chamada algo como **`Saas--main`**. Mova para um lugar fácil, por exemplo a **Área de Trabalho**.

## Passo 3 — Criar o arquivo de configurações (`.env`)

Dentro da pasta existe um arquivo chamado **`.env.example`** (o modelo). Você precisa de uma cópia chamada **`.env`**.

O jeito mais fácil é pelo terminal (próximo passo), com um comando. Siga o passo 4.

> Para este teste local, os valores do modelo já funcionam. **Nunca** use esses valores num servidor real na internet.

## Passo 4 — Abrir o terminal dentro da pasta

**Windows:**
1. Abra a pasta `Saas--main` no Explorador de Arquivos.
2. Clique na barra de endereço lá em cima (onde aparece o caminho da pasta), apague o que estiver escrito, digite `powershell` e aperte **Enter**. Abre uma janela azul/preta já "dentro" da pasta.

**Mac:**
1. Abra o app **Terminal** (procure por "Terminal" no Spotlight, ⌘ + espaço).
2. Digite `cd ` (com um espaço depois), **arraste a pasta** `Saas--main` para dentro da janela do Terminal e aperte **Enter**.

Agora crie o `.env` copiando e colando **um** destes comandos e apertando Enter:

- Windows (PowerShell): `Copy-Item .env.example .env`
- Mac: `cp .env.example .env`

Não aparece nenhuma mensagem — isso é normal, quer dizer que deu certo.

## Passo 5 — Ligar o sistema

Copie, cole e aperte Enter:

```
docker compose up --build
```

O que esse comando faz: **`docker compose`** lê o arquivo `docker-compose.yml` (a "receita"), **`--build`** monta o sistema a partir do código, e **`up`** liga tudo. Ele liga 5 partes:

| Parte | Função |
|---|---|
| `postgres` | Banco de dados (guarda contas, projetos, créditos) |
| `redis` | Fila de tarefas (organiza os vídeos esperando para serem cortados) |
| `s3` | Armazenamento dos vídeos (SeaweedFS, versão local de um "S3") |
| `web` | O site que você vai abrir no navegador |
| `worker` | O "operário" que corta os vídeos com o FFmpeg |

**Na primeira vez demora** (10 a 20 minutos), porque baixa e monta tudo. Vão passar muitas linhas de texto — é normal. Está pronto quando as linhas pararem de correr rápido e aparecer algo como `Worker iniciado` e `Ready` / `started server`.

> **Deixe essa janela aberta.** Fechar a janela desliga o sistema.

## Passo 6 — Usar o sistema

1. Abra o navegador (Chrome, Edge, Safari) e acesse: **http://localhost:3000**
2. Clique em **Criar conta** e cadastre-se (pode ser um e-mail inventado — não é enviado nada de verdade).
3. Vá em **Créditos** → **Adicionar créditos de teste** (créditos sem valor, só para testar).
4. **Projetos** → **Novo projeto** → preencha nome, atleta, partida → **Criar**.
5. Escolha um vídeo MP4 ou MOV do seu computador (de preferência curto, para o primeiro teste), marque a caixa de autorização e clique **Enviar vídeo**. Espere aparecer **"Vídeo pronto"**.
6. **Abrir editor de lances** → marque 3 lances (digitando os horários, ex.: `00:10` a `00:20`, ou usando o player e os botões de bandeira).
7. **Continuar para processamento** → confira o custo → **Confirmar e processar**.
8. Espere ficar **Concluído** e baixe os cortes (um por um ou **Baixar todos (ZIP)**).

### Ver a área de administração (opcional)

Abra **um segundo terminal** na mesma pasta (repita o Passo 4, sem fechar o primeiro) e rode, trocando pelo e-mail que você cadastrou:

```
docker compose exec web pnpm admin:promote seu@email.com
```

O que faz: `exec web` entra na parte "web" que está rodando e executa o comando que transforma sua conta em administradora. Recarregue a página: aparece o menu **Administração**.

### "Esqueci a senha" no teste

Neste modo de teste os e-mails não são enviados de verdade: eles aparecem escritos no primeiro terminal. Procure por `E-MAIL para` e copie o link.

## Passo 7 — Desligar

- No terminal onde o sistema está rodando, aperte **Ctrl + C** (no Mac também é Ctrl, não ⌘). Espere parar.
- Para religar depois: `docker compose up` (sem `--build`, é bem mais rápido).
- Para **apagar tudo** o que foi criado no teste (contas, vídeos, projetos): `docker compose down -v`
  - `down` desliga e remove as "caixas"; `-v` apaga também os dados guardados. **Não há como desfazer.**

---

## Problemas comuns

| O que aparece | O que fazer |
|---|---|
| `docker: command not found` ou `docker não é reconhecido` | O Docker Desktop não está instalado ou não está aberto. Abra-o e espere a bolinha verde. |
| `Cannot connect to the Docker daemon` | O Docker Desktop está fechado ou iniciando. Abra-o e aguarde 1 minuto. |
| `env file ... .env not found` | Faltou o Passo 4 (criar o `.env`). Confira se você está na pasta certa. |
| `port is already allocated` / `porta já em uso` | Outro programa usa a mesma porta (3000, 5432, 6379 ou 8333). Feche-o ou reinicie o computador e tente de novo. |
| A página `localhost:3000` não abre | Espere mais um pouco: na primeira vez demora. Veja se o terminal ainda está trabalhando. |
| O vídeo é recusado | O sistema aceita MP4/MOV com vídeo H.264 ou H.265. A mensagem na tela diz o motivo. |
| O vídeo não aparece no player do editor | Alguns navegadores não tocam H.265 (comum em iPhone). Digite os horários manualmente — o corte funciona normalmente. |

Se algo der errado, copie as últimas linhas do terminal (ou tire um print) e envie para o Claude na próxima sessão.
