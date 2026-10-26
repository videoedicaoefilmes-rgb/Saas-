import { requireUserOrThrow } from "@/server/session";
import { getAssetStatus } from "@/server/services/media";
import { jsonError, noStore } from "@/server/http";

export async function GET(_request: Request, ctx: RouteContext<"/api/assets/[assetId]">) {
  try {
    const user = await requireUserOrThrow();
    const { assetId } = await ctx.params;
    return Response.json(await getAssetStatus(user.id, assetId), { headers: noStore });
  } catch (err) {
    return jsonError(err);
  }
}
