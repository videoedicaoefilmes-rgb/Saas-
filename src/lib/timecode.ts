/**
 * Conversão de marcações de tempo digitadas pelo usuário.
 *
 * Formatos aceitos (frações opcionais com "." ou ","):
 *   "SS"        → segundos            ex.: "95"        = 95 s
 *   "MM:SS"     → minutos:segundos    ex.: "12:35"     = 755 s (minutos podem passar de 59: "95:20")
 *   "HH:MM:SS"  → horas:min:segundos  ex.: "1:02:03"   = 3723 s
 *
 * Em "MM:SS" e "HH:MM:SS" os segundos devem ser < 60; em "HH:MM:SS" os minutos devem ser < 60.
 * Todos os valores internos são em milissegundos inteiros.
 */

export type ParseResult = { ok: true; ms: number } | { ok: false; error: string };

const PART = /^\d+$/;
const LAST_PART = /^\d+(?:[.,]\d{1,3})?$/;

export function parseTimecode(input: string): ParseResult {
  const raw = input.trim();
  if (raw === "") return { ok: false, error: "Informe um horário." };
  if (raw.startsWith("-")) return { ok: false, error: "O horário não pode ser negativo." };

  const parts = raw.split(":");
  if (parts.length > 3) return { ok: false, error: "Formato inválido. Use MM:SS ou HH:MM:SS." };

  const last = parts[parts.length - 1]!;
  const leading = parts.slice(0, -1);
  if (!LAST_PART.test(last) || !leading.every((p) => PART.test(p))) {
    return { ok: false, error: "Formato inválido. Use MM:SS ou HH:MM:SS." };
  }

  const seconds = Number(last.replace(",", "."));
  const secMs = Math.round(seconds * 1000);

  if (parts.length === 1) return { ok: true, ms: secMs };

  if (seconds >= 60) return { ok: false, error: "Os segundos devem ser menores que 60." };

  if (parts.length === 2) {
    const minutes = Number(parts[0]);
    return { ok: true, ms: minutes * 60_000 + secMs };
  }

  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (minutes >= 60) return { ok: false, error: "Os minutos devem ser menores que 60 no formato HH:MM:SS." };
  return { ok: true, ms: hours * 3_600_000 + minutes * 60_000 + secMs };
}

/** Formata milissegundos para exibição: "MM:SS" ou "H:MM:SS"; inclui décimos se houver fração. */
export function formatTimecode(ms: number, opts: { forceHours?: boolean } = {}): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const totalTenths = Math.round(ms / 100);
  const tenths = totalTenths % 10;
  const totalSeconds = Math.floor(totalTenths / 10);
  const s = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const m = totalMinutes % 60;
  const h = Math.floor(totalMinutes / 60);
  const frac = tenths ? `.${tenths}` : "";
  const ss = String(s).padStart(2, "0") + frac;
  if (h > 0 || opts.forceHours) return `${h}:${String(m).padStart(2, "0")}:${ss}`;
  return `${String(totalMinutes).padStart(2, "0")}:${ss}`;
}

/** Duração legível: "1 h 05 min", "12 min 30 s", "45 s". */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")} min`;
  if (m > 0) return s ? `${m} min ${s} s` : `${m} min`;
  return `${s} s`;
}
