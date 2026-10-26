import { createHmac, timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, open, readdir, rm, stat, rename } from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import { assertSafeKey, assertSafePrefix } from "./keys";
import type { ObjectInfo, StorageDriver, UploadTarget } from "./types";

/**
 * Driver local (disco) — para desenvolvimento e testes automatizados.
 * Simula o comportamento de URLs assinadas do S3: o navegador envia/baixa arquivos por
 * /api/storage/local com um token HMAC de curta duração, sem sessão.
 * Não usar em produção com mais de um servidor (o disco não é compartilhado).
 */

export type LocalTokenPayload = {
  /** chave do objeto */
  k: string;
  /** operação */
  o: "put" | "get";
  /** expiração (epoch em segundos) */
  e: number;
  /** tamanho exato esperado (put) */
  s?: number;
  /** content-type */
  ct?: string;
  /** nome para Content-Disposition (get) */
  fn?: string;
};

export class LocalStorage implements StorageDriver {
  readonly name = "local" as const;
  private readonly root: string;

  constructor(
    rootDir: string,
    private readonly secret: string,
    private readonly publicBaseUrl: string,
  ) {
    this.root = path.resolve(rootDir);
  }

  /** Resolve a chave para um caminho dentro da raiz — rejeita qualquer tentativa de sair dela. */
  resolvePath(key: string): string {
    assertSafeKey(key);
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error("Chave fora do diretório de armazenamento");
    return full;
  }

  sign(payload: LocalTokenPayload): string {
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = createHmac("sha256", this.secret).update(body).digest("base64url");
    return `${body}.${sig}`;
  }

  verify(token: string, op: "put" | "get"): LocalTokenPayload | null {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;
    const expected = createHmac("sha256", this.secret).update(body).digest();
    const given = Buffer.from(sig, "base64url");
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    let payload: LocalTokenPayload;
    try {
      payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as LocalTokenPayload;
    } catch {
      return null;
    }
    if (payload.o !== op || typeof payload.k !== "string" || typeof payload.e !== "number") return null;
    if (payload.e < Math.floor(Date.now() / 1000)) return null;
    try {
      assertSafeKey(payload.k);
    } catch {
      return null;
    }
    return payload;
  }

  private url(token: string): string {
    return `${this.publicBaseUrl}/api/storage/local?t=${encodeURIComponent(token)}`;
  }

  async createUploadTarget(key: string, opts: { contentType: string; sizeBytes: number; ttlSeconds: number }): Promise<UploadTarget> {
    assertSafeKey(key);
    const exp = Math.floor(Date.now() / 1000) + opts.ttlSeconds;
    const token = this.sign({ k: key, o: "put", e: exp, s: opts.sizeBytes, ct: opts.contentType });
    return { url: this.url(token), method: "PUT", headers: { "Content-Type": opts.contentType }, expiresAt: new Date(exp * 1000) };
  }

  async createDownloadUrl(key: string, opts: { ttlSeconds: number; downloadFilename?: string; contentType?: string }): Promise<string> {
    assertSafeKey(key);
    const exp = Math.floor(Date.now() / 1000) + opts.ttlSeconds;
    return this.url(this.sign({ k: key, o: "get", e: exp, fn: opts.downloadFilename, ct: opts.contentType }));
  }

  async head(key: string): Promise<ObjectInfo | null> {
    try {
      const s = await stat(this.resolvePath(key));
      return s.isFile() ? { sizeBytes: s.size } : null;
    } catch {
      return null;
    }
  }

  async readHead(key: string, bytes: number): Promise<Buffer> {
    const fh = await open(this.resolvePath(key), "r");
    try {
      const buf = Buffer.alloc(bytes);
      const { bytesRead } = await fh.read(buf, 0, bytes, 0);
      return buf.subarray(0, bytesRead);
    } finally {
      await fh.close();
    }
  }

  async ffmpegInput(key: string): Promise<string> {
    return this.resolvePath(key);
  }

  async putFile(key: string, localPath: string): Promise<void> {
    const dest = this.resolvePath(key);
    await mkdir(path.dirname(dest), { recursive: true });
    const tmp = `${dest}.tmp-${process.pid}-${Date.now()}`;
    await copyFile(localPath, tmp);
    await rename(tmp, dest);
  }

  async getStream(key: string): Promise<Readable> {
    return createReadStream(this.resolvePath(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolvePath(key), { force: true });
  }

  async deletePrefix(prefix: string): Promise<number> {
    assertSafePrefix(prefix);
    const dir = this.resolvePath(prefix.slice(0, -1));
    let count = 0;
    const walk = async (d: string) => {
      let entries;
      try {
        entries = await readdir(d, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        if (e.isDirectory()) await walk(path.join(d, e.name));
        else count++;
      }
    };
    await walk(dir);
    await rm(dir, { recursive: true, force: true });
    return count;
  }
}
