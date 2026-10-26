import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { getLocalStorage } from "@/server/storage";
import { contentDisposition } from "@/server/storage/s3";

/**
 * Endpoint do driver de armazenamento LOCAL (desenvolvimento/testes): emula URLs
 * assinadas do S3. A autorização é o próprio token HMAC de curta duração — gerado
 * somente depois de checar a posse do arquivo. Indisponível com STORAGE_DRIVER=s3.
 */

function denied(status = 403) {
  return new Response(status === 404 ? "Não encontrado" : "Acesso negado", { status });
}

export async function GET(request: Request) {
  const storage = getLocalStorage();
  if (!storage) return denied(404);
  const token = new URL(request.url).searchParams.get("t") ?? "";
  const payload = storage.verify(token, "get");
  if (!payload) return denied();

  const file = storage.resolvePath(payload.k);
  let size: number;
  try {
    size = (await stat(file)).size;
  } catch {
    return denied(404);
  }

  const headers = new Headers({
    "Content-Type": payload.ct ?? "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  if (payload.fn) headers.set("Content-Disposition", contentDisposition(payload.fn));

  // Suporte a Range: necessário para o player de vídeo avançar/retroceder.
  const range = request.headers.get("range");
  const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
  if (m && (m[1] || m[2])) {
    let start = m[1] ? Number(m[1]) : size - Number(m[2]);
    let end = m[1] && m[2] ? Number(m[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(end, size - 1);
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    headers.set("Content-Length", String(end - start + 1));
    const stream = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
    return new Response(stream, { status: 206, headers });
  }

  headers.set("Content-Length", String(size));
  return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, { status: 200, headers });
}

export async function PUT(request: Request) {
  const storage = getLocalStorage();
  if (!storage) return denied(404);
  const token = new URL(request.url).searchParams.get("t") ?? "";
  const payload = storage.verify(token, "put");
  if (!payload || payload.s === undefined) return denied();

  const declared = Number(request.headers.get("content-length"));
  if (!Number.isFinite(declared) || declared !== payload.s) {
    return new Response("Tamanho do envio diferente do autorizado", { status: 400 });
  }
  if (!request.body) return new Response("Corpo vazio", { status: 400 });

  const dest = storage.resolvePath(payload.k);
  await mkdir(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.upload-${Date.now()}`;
  let received = 0;
  const limit = payload.s;
  const source = Readable.fromWeb(request.body as import("node:stream/web").ReadableStream);
  source.on("data", (chunk: Buffer) => {
    received += chunk.length;
    if (received > limit) source.destroy(new Error("limite excedido"));
  });
  try {
    await pipeline(source, createWriteStream(tmp));
    if (received !== limit) throw new Error("envio incompleto");
    await rename(tmp, dest);
  } catch {
    await rm(tmp, { force: true });
    return new Response("Envio interrompido ou inválido", { status: 400 });
  }
  return new Response(null, { status: 200 });
}
