/**
 * Regras de validação de lances — compartilhadas entre cliente (feedback imediato)
 * e servidor (fonte da verdade).
 */

export const CLIP_CATEGORIES = ["GOAL", "ASSIST", "SHOT", "SAVE", "TACKLE", "DRIBBLE", "PASS", "OTHER"] as const;
export type ClipCategoryValue = (typeof CLIP_CATEGORIES)[number];

export const CLIP_CATEGORY_LABELS: Record<ClipCategoryValue, string> = {
  GOAL: "Gol",
  ASSIST: "Assistência",
  SHOT: "Finalização",
  SAVE: "Defesa",
  TACKLE: "Desarme",
  DRIBBLE: "Drible",
  PASS: "Passe",
  OTHER: "Outro",
};

/** Duração mínima de um lance (ms). */
export const MIN_CLIP_MS = 500;

export type ClipRangeInput = { startMs: number; endMs: number };

export type ClipRangeError =
  | "NEGATIVE_START"
  | "END_NOT_AFTER_START"
  | "TOO_SHORT"
  | "TOO_LONG"
  | "OUT_OF_BOUNDS";

export const CLIP_RANGE_MESSAGES: Record<ClipRangeError, string> = {
  NEGATIVE_START: "O início não pode ser negativo.",
  END_NOT_AFTER_START: "O fim deve ser depois do início.",
  TOO_SHORT: "O lance deve ter pelo menos 0,5 segundo.",
  TOO_LONG: "O lance é longo demais.",
  OUT_OF_BOUNDS: "O lance ultrapassa a duração do vídeo.",
};

export function validateClipRange(
  range: ClipRangeInput,
  opts: { videoDurationMs: number | null; maxClipMs: number },
): ClipRangeError | null {
  const { startMs, endMs } = range;
  if (!Number.isInteger(startMs) || !Number.isInteger(endMs)) return "END_NOT_AFTER_START";
  if (startMs < 0) return "NEGATIVE_START";
  if (endMs <= startMs) return "END_NOT_AFTER_START";
  if (endMs - startMs < MIN_CLIP_MS) return "TOO_SHORT";
  if (endMs - startMs > opts.maxClipMs) return "TOO_LONG";
  if (opts.videoDurationMs !== null && endMs > opts.videoDurationMs) return "OUT_OF_BOUNDS";
  return null;
}

/**
 * Intervalo efetivamente cortado: aplica as margens e limita à duração do vídeo.
 */
export function effectiveRange(
  range: ClipRangeInput,
  padding: { beforeMs: number; afterMs: number },
  videoDurationMs: number,
): ClipRangeInput {
  return {
    startMs: Math.max(0, range.startMs - padding.beforeMs),
    endMs: Math.min(videoDurationMs, range.endMs + padding.afterMs),
  };
}
