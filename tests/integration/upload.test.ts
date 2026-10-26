import { statSync } from "node:fs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { getStorage } from "@/server/storage";
import { completeUpload, probeAsset, requestUpload } from "@/server/services/media";
import { createProject } from "@/server/services/projects";
import { closeQueues } from "@/server/queue";
import { fixtures } from "../fixtures/videos";
import { createUser, putLocalObject, resetDb, testFfmpeg } from "../helpers";

async function upload(userId: string, projectId: string, file: string, name: string) {
  const size = statSync(file).size;
  const { assetId } = await requestUpload(userId, { projectId, filename: name, sizeBytes: size, rightsConfirmed: true });
  const asset = await db.mediaAsset.findUniqueOrThrow({ where: { id: assetId } });
  await putLocalObject(asset.storageKey, file);
  return completeUpload(userId, assetId);
}

describe("upload de vídeo", () => {
  beforeEach(resetDb);
  afterAll(closeQueues);

  it("MP4 válido: upload → análise → READY com metadados", async () => {
    const u = await createUser();
    const p = await createProject(u.id, { name: "Jogo" });
    const asset = await upload(u.id, p.id, fixtures.mp4, "jogo.mp4");
    expect(asset.status).toBe("UPLOADED");
    expect(await probeAsset(asset.id, testFfmpeg)).toBe("READY");
    const ready = await db.mediaAsset.findUniqueOrThrow({ where: { id: asset.id } });
    expect(ready).toMatchObject({ width: 320, height: 180, videoCodec: "h264", audioCodec: "aac" });
    expect(ready.durationMs).toBeGreaterThan(59_000);
    expect(ready.durationMs).toBeLessThan(61_000);
    expect(ready.storageKey.startsWith(`users/${u.id}/projects/${p.id}/source/`)).toBe(true);
  });

  it("MOV sem áudio é aceito", async () => {
    const u = await createUser();
    const p = await createProject(u.id, { name: "Jogo" });
    const asset = await upload(u.id, p.id, fixtures.movNoAudio, "jogo.MOV");
    expect(await probeAsset(asset.id, testFfmpeg)).toBe("READY");
    const ready = await db.mediaAsset.findUniqueOrThrow({ where: { id: asset.id } });
    expect(ready.audioCodec).toBeNull();
  });

  it("rejeita extensão não permitida antes do envio", async () => {
    const u = await createUser();
    const p = await createProject(u.id, { name: "Jogo" });
    await expect(requestUpload(u.id, { projectId: p.id, filename: "jogo.avi", sizeBytes: 1000, rightsConfirmed: true })).rejects.toThrow(/MP4 ou MOV/);
  });

  it("rejeita arquivo maior que o limite", async () => {
    const u = await createUser();
    const p = await createProject(u.id, { name: "Jogo" });
    await expect(
      requestUpload(u.id, { projectId: p.id, filename: "jogo.mp4", sizeBytes: 50 * 1024 ** 3, rightsConfirmed: true }),
    ).rejects.toThrow(/limite/);
  });

  it("exige confirmação de autorização de uso do vídeo", async () => {
    const u = await createUser();
    const p = await createProject(u.id, { name: "Jogo" });
    await expect(requestUpload(u.id, { projectId: p.id, filename: "jogo.mp4", sizeBytes: 1000, rightsConfirmed: false })).rejects.toThrow();
  });

  it("texto disfarçado de .mp4 é rejeitado pela assinatura real e removido", async () => {
    const u = await createUser();
    const p = await createProject(u.id, { name: "Jogo" });
    const asset = await upload(u.id, p.id, fixtures.fakeMp4, "falso.mp4");
    expect(asset.status).toBe("REJECTED");
    expect(asset.rejectionReason).toMatch(/não é um vídeo/);
    expect(await getStorage().head(asset.storageKey)).toBeNull();
  });

  it("codec não suportado é rejeitado após análise", async () => {
    const u = await createUser();
    const p = await createProject(u.id, { name: "Jogo" });
    const asset = await upload(u.id, p.id, fixtures.movMjpeg, "mjpeg.mov");
    expect(await probeAsset(asset.id, testFfmpeg)).toBe("REJECTED");
    const rejected = await db.mediaAsset.findUniqueOrThrow({ where: { id: asset.id } });
    expect(rejected.rejectionReason).toMatch(/Codec/);
  });

  it("tamanho divergente do declarado é rejeitado", async () => {
    const u = await createUser();
    const p = await createProject(u.id, { name: "Jogo" });
    const { assetId } = await requestUpload(u.id, { projectId: p.id, filename: "a.mp4", sizeBytes: 123, rightsConfirmed: true });
    const asset = await db.mediaAsset.findUniqueOrThrow({ where: { id: assetId } });
    await putLocalObject(asset.storageKey, fixtures.mp4);
    const res = await completeUpload(u.id, assetId);
    expect(res.status).toBe("REJECTED");
  });

  it("concluir sem ter enviado o arquivo informa erro", async () => {
    const u = await createUser();
    const p = await createProject(u.id, { name: "Jogo" });
    const { assetId } = await requestUpload(u.id, { projectId: p.id, filename: "a.mp4", sizeBytes: 123, rightsConfirmed: true });
    await expect(completeUpload(u.id, assetId)).rejects.toThrow(/Não recebemos/);
  });

  it("novo vídeo substitui o anterior do projeto", async () => {
    const u = await createUser();
    const p = await createProject(u.id, { name: "Jogo" });
    const first = await upload(u.id, p.id, fixtures.mp4, "a.mp4");
    const second = await upload(u.id, p.id, fixtures.movNoAudio, "b.mov");
    const old = await db.mediaAsset.findUniqueOrThrow({ where: { id: first.id } });
    expect(old.status).toBe("DELETED");
    expect(await getStorage().head(first.storageKey)).toBeNull();
    expect(second.status).toBe("UPLOADED");
  });
});
