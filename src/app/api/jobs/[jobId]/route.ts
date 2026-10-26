import { requireUserOrThrow } from "@/server/session";
import { getOwnedJob } from "@/server/services/processing";
import { jsonError, noStore } from "@/server/http";

/** Status do processamento (consultado periodicamente pela tela de acompanhamento). */
export async function GET(_request: Request, ctx: RouteContext<"/api/jobs/[jobId]">) {
  try {
    const user = await requireUserOrThrow();
    const { jobId } = await ctx.params;
    const job = await getOwnedJob(user.id, jobId);
    return Response.json(
      {
        id: job.id,
        status: job.status,
        errorMessage: job.errorMessage,
        creditStatus: job.creditStatus,
        exports: job.exports.map((e) => ({ id: e.id, position: e.position, status: e.status })),
      },
      { headers: noStore },
    );
  } catch (err) {
    return jsonError(err);
  }
}
