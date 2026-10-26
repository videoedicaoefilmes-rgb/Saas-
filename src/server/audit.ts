import type { Prisma } from "@/generated/prisma/client";
import { db, type Tx } from "./db";

export type AuditInput = {
  actorUserId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Prisma.InputJsonValue;
};

/** Registro de auditoria. Não incluir dados pessoais desnecessários em `metadata`. */
export async function audit(input: AuditInput, tx: Tx = db): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata,
    },
  });
}
