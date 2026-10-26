import { db } from "../db";

/** Números do painel do usuário (últimos `days` dias). */
export async function getUserDashboardStats(userId: string, days = 30) {
  const since = new Date(Date.now() - days * 86400_000);
  const [active, processed] = await Promise.all([
    db.processingJob.count({ where: { userId, status: { in: ["QUEUED", "RUNNING"] } } }),
    db.processingJob.aggregate({
      where: { userId, status: "SUCCEEDED", finishedAt: { gte: since } },
      _sum: { billableSeconds: true, clipCount: true },
    }),
  ]);
  return {
    activeJobs: active,
    clipsProcessed: processed._sum.clipCount ?? 0,
    minutesProcessed: (processed._sum.billableSeconds ?? 0) / 60,
  };
}
