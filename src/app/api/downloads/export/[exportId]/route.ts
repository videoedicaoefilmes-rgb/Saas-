import { requireUserOrThrow } from "@/server/session";
import { getExportDownloadUrl } from "@/server/services/exports";
import { jsonError } from "@/server/http";

/** Confere a posse do arquivo e redireciona para uma URL assinada de curta duração. */
export async function GET(_request: Request, ctx: RouteContext<"/api/downloads/export/[exportId]">) {
  try {
    const user = await requireUserOrThrow();
    const { exportId } = await ctx.params;
    const url = await getExportDownloadUrl(user.id, exportId);
    return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  } catch (err) {
    return jsonError(err);
  }
}
