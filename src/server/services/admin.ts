import { db } from "../db";

/**
 * Consultas do painel administrativo. Somente agregados e dados operacionais;
 * não expõe vídeos de clientes.
 */

export async function getOverviewMetrics(sinceDays = 30) {
  const since = new Date(Date.now() - sinceDays * 86400_000);
  const [users, newUsers, projects, uploads, uploadedAgg, jobsByStatus, processedAgg, creditsConsumed, storageSources, storageExports] =
    await Promise.all([
      db.user.count(),
      db.user.count({ where: { createdAt: { gte: since } } }),
      db.project.count(),
      db.mediaAsset.count({ where: { uploadedAt: { gte: since } } }),
      db.mediaAsset.aggregate({ where: { uploadedAt: { gte: since }, durationMs: { not: null } }, _sum: { durationMs: true, sizeBytes: true } }),
      db.processingJob.groupBy({ by: ["status"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
      db.processingJob.aggregate({
        where: { status: "SUCCEEDED", finishedAt: { gte: since } },
        _sum: { billableSeconds: true, processingMs: true, outputBytes: true, estimatedCostCents: true },
        _avg: { processingMs: true },
        _count: { _all: true },
      }),
      db.processingJob.aggregate({ where: { creditStatus: "CAPTURED", finishedAt: { gte: since } }, _sum: { creditsCharged: true } }),
      db.mediaAsset.aggregate({ where: { status: { in: ["READY", "UPLOADED", "PROBING"] } }, _sum: { sizeBytes: true } }),
      db.export.aggregate({ where: { status: "DONE" }, _sum: { sizeBytes: true } }),
    ]);

  const statusCount = Object.fromEntries(jobsByStatus.map((g) => [g.status, g._count._all])) as Record<string, number>;
  const finished = (statusCount.SUCCEEDED ?? 0) + (statusCount.FAILED ?? 0);
  return {
    sinceDays,
    users,
    newUsers,
    projects,
    uploads,
    uploadedMinutes: (uploadedAgg._sum.durationMs ?? 0) / 60_000,
    uploadedBytes: Number(uploadedAgg._sum.sizeBytes ?? 0),
    jobs: statusCount,
    errorRate: finished > 0 ? (statusCount.FAILED ?? 0) / finished : null,
    processedMinutes: (processedAgg._sum.billableSeconds ?? 0) / 60,
    processingMinutes: (processedAgg._sum.processingMs ?? 0) / 60_000,
    avgProcessingMs: processedAgg._avg.processingMs,
    outputBytes: Number(processedAgg._sum.outputBytes ?? 0),
    estimatedCostCents: processedAgg._sum.estimatedCostCents,
    creditsConsumed: creditsConsumed._sum.creditsCharged ?? 0,
    storageBytes: Number(storageSources._sum.sizeBytes ?? 0) + Number(storageExports._sum.sizeBytes ?? 0),
  };
}

export async function listUsers(opts: { query?: string; take?: number } = {}) {
  const q = opts.query?.trim();
  return db.user.findMany({
    where: q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } : undefined,
    orderBy: { createdAt: "desc" },
    take: opts.take ?? 100,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      wallet: { select: { balance: true } },
      _count: { select: { projects: true, processingJobs: true } },
    },
  });
}

export async function getUserDetail(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      termsAcceptedAt: true,
      termsVersion: true,
      wallet: { select: { balance: true } },
      creditTransactions: { orderBy: { createdAt: "desc" }, take: 50, include: { actor: { select: { name: true } } } },
      processingJobs: { orderBy: { createdAt: "desc" }, take: 20, include: { project: { select: { name: true } } } },
    },
  });
}

export async function listProjectsAdmin(take = 100) {
  return db.project.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      name: true,
      createdAt: true,
      user: { select: { id: true, email: true } },
      _count: { select: { clips: true, processingJobs: true } },
    },
  });
}

export async function listJobsAdmin(opts: { status?: string; take?: number } = {}) {
  const statuses = ["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELED"] as const;
  const status = statuses.find((s) => s === opts.status);
  return db.processingJob.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: opts.take ?? 100,
    include: { user: { select: { id: true, email: true } }, project: { select: { name: true } } },
  });
}

export async function listCreditTransactionsAdmin(take = 100) {
  return db.creditTransaction.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: { user: { select: { id: true, email: true } }, actor: { select: { email: true } } },
  });
}

export async function listAuditLogs(take = 100) {
  return db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take, include: { actor: { select: { email: true } } } });
}
