import { readFileSync, statSync } from "node:fs";
import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { beforeAll, describe, expect, it } from "vitest";
import { S3Storage } from "@/server/storage/s3";
import { probe } from "@/server/media/ffmpeg";
import { fixtures } from "../fixtures/videos";
import { testFfmpeg } from "../helpers";

/**
 * Driver S3 contra um servidor compatível real (MinIO, moto, R2...).
 * Executado apenas com S3_TEST_ENDPOINT definido, ex.:
 *   S3_TEST_ENDPOINT=http://localhost:9900 pnpm test tests/integration/storage-s3.test.ts
 */
const endpoint = process.env.S3_TEST_ENDPOINT;
const creds = { accessKeyId: process.env.S3_TEST_KEY ?? "test", secretAccessKey: process.env.S3_TEST_SECRET ?? "test" };
const bucket = `gm-test-${Date.now()}`;

describe.skipIf(!endpoint)("armazenamento S3", () => {
  const storage = new S3Storage(bucket, { endpoint, region: "us-east-1", forcePathStyle: true, ...creds });
  const key = "users/user12345/projects/proj12345/source/asset12345.mp4";

  beforeAll(async () => {
    const client = new S3Client({ endpoint, region: "us-east-1", forcePathStyle: true, credentials: creds });
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  });

  it("upload direto por URL assinada, leitura de metadados e ffprobe via HTTPS/HTTP", async () => {
    const size = statSync(fixtures.mp4).size;
    const target = await storage.createUploadTarget(key, { contentType: "video/mp4", sizeBytes: size, ttlSeconds: 300 });
    const res = await fetch(target.url, { method: "PUT", headers: target.headers, body: readFileSync(fixtures.mp4) });
    expect(res.status).toBe(200);

    expect(await storage.head(key)).toEqual({ sizeBytes: size });
    expect((await storage.readHead(key, 12)).subarray(4, 8).toString("latin1")).toBe("ftyp");

    const input = await storage.ffmpegInput(key, 300);
    const info = await probe(input, testFfmpeg);
    expect(info.video?.codec).toBe("h264");
    expect(info.durationMs).toBeGreaterThan(59_000);
  });

  it("URL de download força o nome do arquivo", async () => {
    const url = await storage.createDownloadUrl(key, { ttlSeconds: 60, downloadFilename: "joão_lance_001.mp4" });
    const res = await fetch(url);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain("lance_001.mp4");
    await res.arrayBuffer();
  });

  it("URL adulterada não entrega o arquivo", async () => {
    // S3/MinIO reais respondem 403 (assinatura inválida); o simulador "moto" não valida
    // assinaturas e responde 404. Em ambos os casos o conteúdo não é entregue.
    const url = await storage.createDownloadUrl(key, { ttlSeconds: 60 });
    const res = await fetch(url.replace("asset12345", "outro12345"));
    expect(res.ok).toBe(false);
  });

  it("objeto inexistente → null; exclusão por prefixo", async () => {
    expect(await storage.head("users/user12345/nada.mp4")).toBeNull();
    expect(await storage.deletePrefix("users/user12345/")).toBe(1);
    expect(await storage.head(key)).toBeNull();
  });
});
