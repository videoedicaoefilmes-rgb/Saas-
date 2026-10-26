import { Badge } from "@/components/ui/badge";

const JOB: Record<string, { label: string; tone: "neutral" | "success" | "warning" | "danger" | "info" }> = {
  QUEUED: { label: "Na fila", tone: "info" },
  RUNNING: { label: "Processando", tone: "warning" },
  SUCCEEDED: { label: "Concluído", tone: "success" },
  FAILED: { label: "Falhou", tone: "danger" },
  CANCELED: { label: "Cancelado", tone: "neutral" },
};

const ASSET: Record<string, { label: string; tone: "neutral" | "success" | "warning" | "danger" | "info" }> = {
  PENDING_UPLOAD: { label: "Envio pendente", tone: "neutral" },
  UPLOADED: { label: "Validando", tone: "info" },
  PROBING: { label: "Validando", tone: "info" },
  READY: { label: "Vídeo pronto", tone: "success" },
  REJECTED: { label: "Vídeo recusado", tone: "danger" },
  DELETED: { label: "Removido", tone: "neutral" },
};

export function JobStatusBadge({ status }: { status: string }) {
  const s = JOB[status] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function AssetStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <Badge>Sem vídeo</Badge>;
  const s = ASSET[status] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export const TX_LABELS: Record<string, string> = {
  SIGNUP_BONUS: "Boas-vindas",
  TEST_GRANT: "Créditos de teste",
  PURCHASE: "Compra",
  SUBSCRIPTION_GRANT: "Assinatura",
  PROMO_GRANT: "Promoção",
  ADMIN_ADJUSTMENT: "Ajuste administrativo",
  PROCESSING_HOLD: "Reserva de processamento",
  PROCESSING_CAPTURE: "Consumo confirmado",
  PROCESSING_REFUND: "Reembolso",
  EXPIRATION: "Expiração",
};
