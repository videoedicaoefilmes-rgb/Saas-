import { requireUserOrThrow } from "@/server/session";
import { completeUpload } from "@/server/services/media";
import { assertSameOrigin, jsonError, noStore } from "@/server/http";

/** Etapa 2 do upload: confere o arquivo recebido e agenda a análise. */
export async function POST(request: Request, ctx: RouteContext<"/api/uploads/[assetId]/complete">) {
  try {
    assertSameOrigin(request);
    const user = await requireUserOrThrow();
    const { assetId } = await ctx.params;
    const asset = await completeUpload(user.id, assetId);
    return Response.json({ id: asset.id, status: asset.status, rejectionReason: asset.rejectionReason }, { headers: noStore });
  } catch (err) {
    return jsonError(err);
  }
}
