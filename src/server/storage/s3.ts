import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { assertSafeKey, assertSafePrefix } from "./keys";
import type { ObjectInfo, StorageDriver, UploadTarget } from "./types";

/**
 * Driver para serviços compatíveis com S3 (AWS S3, Cloudflare R2, Backblaze B2, MinIO...).
 * O bucket deve ser PRIVADO (sem acesso público); todo acesso é por URL assinada.
 */
export class S3Storage implements StorageDriver {
  readonly name = "s3" as const;
  private readonly client: S3Client;

  constructor(
    private readonly bucket: string,
    config: { endpoint?: string; region: string; accessKeyId: string; secretAccessKey: string; forcePathStyle: boolean },
  ) {
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint || undefined,
      forcePathStyle: config.forcePathStyle,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
  }

  async createUploadTarget(key: string, opts: { contentType: string; sizeBytes: number; ttlSeconds: number }): Promise<UploadTarget> {
    assertSafeKey(key);
    // ContentLength entra na assinatura: o envio só é aceito com exatamente o tamanho declarado
    // (que já foi validado contra o limite). O tamanho real é conferido de novo após o upload.
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: opts.contentType,
      ContentLength: opts.sizeBytes,
    });
    const url = await getSignedUrl(this.client, command, {
      expiresIn: opts.ttlSeconds,
      signableHeaders: new Set(["content-type", "content-length"]),
    });
    return {
      url,
      method: "PUT",
      headers: { "Content-Type": opts.contentType },
      expiresAt: new Date(Date.now() + opts.ttlSeconds * 1000),
    };
  }

  async createDownloadUrl(key: string, opts: { ttlSeconds: number; downloadFilename?: string; contentType?: string }): Promise<string> {
    assertSafeKey(key);
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: opts.downloadFilename ? contentDisposition(opts.downloadFilename) : undefined,
      ResponseContentType: opts.contentType,
    });
    return getSignedUrl(this.client, command, { expiresIn: opts.ttlSeconds });
  }

  async head(key: string): Promise<ObjectInfo | null> {
    assertSafeKey(key);
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { sizeBytes: Number(res.ContentLength ?? 0) };
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }

  async readHead(key: string, bytes: number): Promise<Buffer> {
    assertSafeKey(key);
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: `bytes=0-${bytes - 1}` }));
    const arr = await res.Body!.transformToByteArray();
    return Buffer.from(arr);
  }

  async ffmpegInput(key: string, ttlSeconds: number): Promise<string> {
    // O FFmpeg lê por HTTP com requisições Range: só baixa os trechos necessários.
    return this.createDownloadUrl(key, { ttlSeconds });
  }

  async putFile(key: string, localPath: string, contentType: string): Promise<void> {
    assertSafeKey(key);
    const { size } = await stat(localPath);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: createReadStream(localPath),
        ContentLength: size,
        ContentType: contentType,
      }),
    );
  }

  async getStream(key: string): Promise<Readable> {
    assertSafeKey(key);
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return res.Body as Readable;
  }

  async delete(key: string): Promise<void> {
    assertSafeKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async deletePrefix(prefix: string): Promise<number> {
    assertSafePrefix(prefix);
    let count = 0;
    let token: string | undefined;
    do {
      const list = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }),
      );
      const keys = (list.Contents ?? []).map((o) => ({ Key: o.Key! }));
      if (keys.length > 0) {
        await this.client.send(new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: keys, Quiet: true } }));
        count += keys.length;
      }
      token = list.IsTruncated ? list.NextContinuationToken : undefined;
    } while (token);
    return count;
  }
}

export function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function isNotFound(err: unknown): boolean {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.name === "NotFound" || e?.name === "NoSuchKey" || e?.$metadata?.httpStatusCode === 404;
}
