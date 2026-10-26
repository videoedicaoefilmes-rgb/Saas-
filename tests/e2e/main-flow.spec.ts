import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { fixtures } from "../fixtures/videos";

/**
 * Critério de sucesso do MVP, executado num navegador real contra o build de produção e o worker:
 * Cadastro → Login → Projeto → Upload → 3 lances → Custo → Processamento → Download → Créditos → Isolamento.
 */

const password = "senha-segura-123";
const tmp = mkdtempSync(path.join(os.tmpdir(), "gm-e2e-"));

function probeDuration(file: string): number {
  return Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString());
}

async function signUp(page: Page, name: string, email: string) {
  await page.goto("/cadastro");
  await page.getByLabel("Nome").fill(name);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByLabel("Confirme a senha").fill(password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/painel/);
}

test.describe.serial("fluxo principal do MVP", () => {
  const stamp = Date.now();
  const owner = { name: "Carla Souza", email: `carla-${stamp}@teste.dev` };
  let projectUrl = "";
  let jobUrl = "";
  let exportIds: string[] = [];

  test("cadastro, logout e login", async ({ page }) => {
    await signUp(page, owner.name, owner.email);
    await expect(page.getByRole("heading", { name: "Olá, Carla" })).toBeVisible();
    await expect(page.getByText("Conta criada!")).toBeVisible();

    await page.getByRole("button", { name: "Sair" }).first().click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/painel");
    await expect(page).toHaveURL(/\/entrar/);

    await page.getByLabel("E-mail").fill(owner.email);
    await page.getByLabel("Senha").fill("senha-errada-999");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
    // O e-mail digitado continua no campo após o erro (a senha, por segurança, não).
    await expect(page.getByLabel("E-mail")).toHaveValue(owner.email);
    await page.getByLabel("Senha").fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/painel/);
  });

  test("projeto, upload, lances, custo, processamento e download", async ({ page }) => {
    await page.goto("/entrar");
    await page.getByLabel("E-mail").fill(owner.email);
    await page.getByLabel("Senha").fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/painel/);

    // Créditos de teste
    await page.goto("/creditos");
    await page.getByRole("button", { name: /Adicionar 60 créditos de teste/ }).click();
    await expect(page.getByText("60 créditos de teste adicionados.")).toBeVisible();

    // Projeto
    await page.goto("/projetos/novo");
    await page.getByLabel("Nome do projeto *").fill("Final Copa Verão");
    await page.getByLabel("Atleta", { exact: true }).fill("João Pedro");
    await page.getByLabel("Partida", { exact: true }).fill("Final Sub-15");
    await page.getByRole("button", { name: "Criar projeto e enviar vídeo" }).click();
    await expect(page).toHaveURL(/\/projetos\/c[a-z0-9]{20,}$/);
    projectUrl = page.url();

    // Upload inválido (não é vídeo) é recusado
    await page.getByTestId("video-input").setInputFiles(fixtures.fakeMp4);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Enviar vídeo" }).click();
    await expect(page.getByText("O arquivo não é um vídeo MP4 ou MOV válido.")).toBeVisible();

    // Upload válido
    await page.getByTestId("video-input").setInputFiles(fixtures.mp4);
    await page.getByRole("button", { name: "Enviar vídeo" }).click();
    await expect(page.getByText("Vídeo pronto")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("01:00")).toBeVisible();

    // Três lances
    await page.getByRole("link", { name: "Abrir editor de lances" }).click();
    await expect(page.getByRole("heading", { name: "Editor de lances" })).toBeVisible();
    const lances: Array<[string, string, string]> = [
      ["00:05", "00:12.5", "Assistência"],
      ["00:20", "00:31", "Finalização"],
      ["00:45", "00:58", "Desarme"],
    ];
    for (const [start, end, title] of lances) {
      await page.getByLabel("Início *").fill(start);
      await page.getByLabel("Fim *").fill(end);
      await page.getByLabel("Título", { exact: true }).fill(title);
      await page.getByRole("button", { name: "Adicionar lance" }).click();
      await expect(page.getByTestId("clip-list").getByText(title)).toBeVisible();
    }
    // Validação imediata: fim antes do início
    await page.getByLabel("Início *").fill("00:30");
    await page.getByLabel("Fim *").fill("00:10");
    await expect(page.getByText("O fim deve ser depois do início.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Adicionar lance" })).toBeDisabled();
    // Fora da duração do vídeo
    await page.getByLabel("Fim *").fill("01:30");
    await expect(page.getByText("O lance ultrapassa a duração do vídeo.")).toBeVisible();

    // Custo
    await page.getByRole("link", { name: "Continuar para processamento" }).click();
    await expect(page.getByRole("heading", { name: "Confirmar processamento" })).toBeVisible();
    await expect(page.getByTestId("cost")).toHaveText("1 crédito");
    await page.getByRole("button", { name: /Confirmar e processar/ }).click();

    // Processamento real pelo worker
    await expect(page).toHaveURL(/\/processamentos\/[a-f0-9]{32}$/);
    jobUrl = page.url();
    await expect(page.getByText("Concluído")).toBeVisible({ timeout: 120_000 });
    await expect(page.getByTestId("job-progress")).toHaveText("3 de 3 lance(s) prontos");

    // Downloads individuais
    const links = page.getByTestId("download-clip");
    await expect(links).toHaveCount(3);
    exportIds = await links.evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).href.split("/").pop()!));
    const expected = [7.5, 11, 13];
    for (let i = 0; i < 3; i++) {
      const [download] = await Promise.all([page.waitForEvent("download"), links.nth(i).click()]);
      expect(download.suggestedFilename()).toBe(`joao_pedro_final_sub-15_lance_00${i + 1}.mp4`);
      const file = path.join(tmp, download.suggestedFilename());
      await download.saveAs(file);
      expect(Math.abs(probeDuration(file) - expected[i]!)).toBeLessThan(0.15);
    }

    // ZIP com os três arquivos
    const [zipDownload] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download-zip").click()]);
    expect(zipDownload.suggestedFilename()).toBe("joao_pedro_final_sub-15_lances.zip");
    const zipPath = path.join(tmp, "lances.zip");
    await zipDownload.saveAs(zipPath);
    const listing = execFileSync("python3", ["-c", "import sys,zipfile;print('\\n'.join(zipfile.ZipFile(sys.argv[1]).namelist()))", zipPath]).toString();
    expect(listing.trim().split("\n").sort()).toEqual([
      "joao_pedro_final_sub-15_lance_001.mp4",
      "joao_pedro_final_sub-15_lance_002.mp4",
      "joao_pedro_final_sub-15_lance_003.mp4",
    ]);

    // Créditos: 60 − 1 = 59, com reserva e confirmação no extrato
    await page.goto("/creditos");
    await expect(page.getByText("Saldo disponível").locator("..")).toContainText("59");
    const ledger = page.getByTestId("ledger");
    await expect(ledger).toContainText("Reserva de processamento");
    await expect(ledger).toContainText("Consumo confirmado");
    await expect(ledger).toContainText("Créditos de teste");
  });

  test("outro usuário não acessa projeto, processamento nem arquivos", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await signUp(page, "Intruso", `intruso-${stamp}@teste.dev`);

    for (const url of [projectUrl, `${projectUrl}/lances`, `${projectUrl}/processar`, jobUrl]) {
      const res = await page.goto(url);
      expect(res?.status(), url).toBe(404);
      await expect(page.getByText("Página não encontrada")).toBeVisible();
    }
    const jobId = jobUrl.split("/").pop()!;
    for (const api of [...exportIds.map((id) => `/api/downloads/export/${id}`), `/api/downloads/job/${jobId}`, `/api/jobs/${jobId}`]) {
      const res = await page.request.get(api, { maxRedirects: 0 });
      expect(res.status(), api).toBe(404);
    }
    await context.close();

    // Sem login: 401
    const anon = await browser.newContext();
    const res = await anon.request.get(`/api/downloads/export/${exportIds[0]}`, { maxRedirects: 0 });
    expect(res.status()).toBe(401);
    // Token de armazenamento adulterado é recusado (403 com armazenamento local; 404 com S3, rota desligada)
    const forged = await anon.request.get(`/api/storage/local?t=abc.def`);
    expect([403, 404]).toContain(forged.status());
    await anon.close();
  });

  test("usuário comum não vê a administração", async ({ page }) => {
    await page.goto("/entrar");
    await page.getByLabel("E-mail").fill(owner.email);
    await page.getByLabel("Senha").fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/painel/);
    const res = await page.goto("/admin");
    expect(res?.status()).toBe(404);
  });
});

test("@mobile fluxo de criação de projeto funciona no celular", async ({ page }) => {
  await signUp(page, "Pai Celular", `celular-${Date.now()}@teste.dev`);
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("link", { name: "Projetos" }).click();
  await page.getByRole("link", { name: "Criar primeiro projeto" }).click();
  await page.getByLabel("Nome do projeto *").fill("Jogo do domingo");
  await page.getByRole("button", { name: "Criar projeto e enviar vídeo" }).click();
  await expect(page.getByRole("heading", { name: "Jogo do domingo" })).toBeVisible();
  await expect(page.getByText("Escolher vídeo da partida")).toBeVisible();
  // Sem rolagem horizontal
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test.afterAll(() => {
  writeFileSync(path.join(tmp, ".done"), "");
});
