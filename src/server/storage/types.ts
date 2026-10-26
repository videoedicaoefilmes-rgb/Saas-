import type { Readable } from "node:stream";

export type UploadTarget = {
  url: string;
  method: "PUT";
  /** Cabeçalhos que o navegador deve enviar exatamente como estão (fazem parte da assinatura). */
  headers: Record<string, string>;
  expiresAt: Date;
};

export type ObjectInfo = { sizeBytes: number };

/**
 * Armazenamento de objetos privado. Chaves são sempre geradas pelo servidor
 * (ver keys.ts) — nunca derivadas de nomes de arquivo ou outros dados do usuário.
 */
export interface StorageDriver {
  readonly name: "local" | "s3";
  /** URL temporária para o navegador enviar o arquivo diretamente ao armazenamento. */
  createUploadTarget(key: string, opts: { contentType: string; sizeBytes: number; ttlSeconds: number }): Promise<UploadTarget>;
  /** URL temporária de leitura. `downloadFilename` força download com esse nome. */
  createDownloadUrl(key: string, opts: { ttlSeconds: number; downloadFilename?: string; contentType?: string }): Promise<string>;
  head(key: string): Promise<ObjectInfo | null>;
  /** Lê os primeiros bytes (validação de assinatura de formato). */
  readHead(key: string, bytes: number): Promise<Buffer>;
  /** Entrada para o FFmpeg: caminho local ou URL assinada (HTTP com suporte a Range). */
  ffmpegInput(key: string, ttlSeconds: number): Promise<string>;
  putFile(key: string, localPath: string, contentType: string): Promise<void>;
  getStream(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<number>;
}
