import { downloadZip } from "client-zip";
import { Readable } from "node:stream";
import { requireUserOrThrow } from "@/server/session";
import { getJobZipManifest } from "@/server/services/exports";
import { getStorage } from "@/server/storage";
import { contentDisposition } from "@/server/storage/s3";
import { jsonError } from "@/server/http";
import { logger } from "@/server/logger";

/**
 * ZIP com todos os lances de um processamento, gerado em streaming (sem arquivo temporário
 * e sem recompressão — MP4 já é comprimido).
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/downloads/job/[jobId]">) {
  try {
    const user = await requireUserOrThrow();
    const { jobId } = await ctx.params;
    const manifest = await getJobZipManifest(user.id, jobId);
    const storage = getStorage();

    async function* files() {
      for (const entry of manifest.entries) {
        const stream = await storage.getStream(entry.storageKey);
        yield {
          name: entry.filename,
          lastModified: entry.modifiedAt,
          size: entry.sizeBytes,
          input: Readable.toWeb(stream) as ReadableStream<Uint8Array>,
        };
      }
    }

    const zip = downloadZip(files(), {
      metadata: manifest.entries.map((e) => ({ name: e.filename, size: e.sizeBytes })),
    });
    logger.info({ correlationId: jobId, files: manifest.entries.length }, "Download ZIP iniciado");
    const headers = new Headers(zip.headers);
    headers.set("Content-Type", "application/zip");
    headers.set("Content-Disposition", contentDisposition(manifest.zipName));
    headers.set("Cache-Control", "private, no-store");
    return new Response(zip.body, { status: 200, headers });
  } catch (err) {
    return jsonError(err);
  }
}
