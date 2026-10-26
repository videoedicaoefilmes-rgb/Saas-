import { spawn } from "node:child_process";

/**
 * Integração com FFmpeg/FFprobe.
 *
 * Segurança:
 * - Processos iniciados com `spawn(binário, [args])`, SEM shell: nenhuma entrada do usuário
 *   é interpretada como comando. Tempos são números validados; caminhos/URLs são gerados
 *   pelo servidor.
 * - Demuxer forçado (`-f mov`, que lê MP4 e MOV): o FFmpeg nunca "adivinha" o formato,
 *   o que impede arquivos disfarçados (ex.: playlists HLS/concat) de lerem outros arquivos.
 * - `-protocol_whitelist` restrito: arquivo local OU HTTPS (URL assinada), nunca ambos.
 * - Tempo máximo por processo; o processo é encerrado (SIGKILL) ao estourar.
 */

export type FfmpegConfig = { ffmpegPath: string; ffprobePath: string; threads: number; timeoutMs: number };

export class FfmpegError extends Error {
  constructor(
    message: string,
    public readonly kind: "timeout" | "exit" | "spawn",
    public readonly stderrTail: string,
  ) {
    super(message);
    this.name = "FfmpegError";
  }
}

type RunResult = { stdout: string; stderr: string };

export function runProcess(bin: string, args: string[], timeoutMs: number): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { shell: false, stdio: ["ignore", "pipe", "pipe"] });
    const out: Buffer[] = [];
    let outLen = 0;
    let stderr = "";
    const MAX_OUT = 4 * 1024 * 1024;
    const MAX_ERR = 16 * 1024;
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      if (outLen < MAX_OUT) {
        out.push(chunk);
        outLen += chunk.length;
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = (stderr + chunk.toString("utf8")).slice(-MAX_ERR);
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new FfmpegError(`Falha ao iniciar ${bin}: ${err.message}`, "spawn", ""));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) return reject(new FfmpegError("Tempo limite de processamento excedido", "timeout", stderr));
      if (code !== 0) return reject(new FfmpegError(`${bin} terminou com código ${code}`, "exit", stderr));
      resolve({ stdout: Buffer.concat(out).toString("utf8"), stderr });
    });
  });
}

function isRemote(input: string): boolean {
  return input.startsWith("https://") || input.startsWith("http://");
}

/** Opções de entrada seguras (antes de `-i`). */
function inputOptions(input: string): string[] {
  return isRemote(input)
    ? ["-protocol_whitelist", "https,http,tls,tcp,crypto", "-rw_timeout", "30000000", "-f", "mov"]
    : ["-protocol_whitelist", "file", "-f", "mov"];
}

// ─── Probe ───────────────────────────────────────────────────────────────────

export type ProbeInfo = {
  formatName: string;
  durationMs: number;
  bitRate: number | null;
  video: { codec: string; width: number; height: number; fps: number | null } | null;
  audio: { codec: string; channels: number | null } | null;
};

type RawProbe = {
  format?: { format_name?: string; duration?: string; bit_rate?: string };
  streams?: Array<{
    codec_type?: string;
    codec_name?: string;
    width?: number;
    height?: number;
    avg_frame_rate?: string;
    r_frame_rate?: string;
    channels?: number;
    disposition?: { attached_pic?: number };
  }>;
};

function parseRate(rate?: string): number | null {
  if (!rate) return null;
  const [n, d] = rate.split("/").map(Number);
  if (!n || !d) return null;
  return Math.round((n / d) * 1000) / 1000;
}

export async function probe(input: string, cfg: FfmpegConfig): Promise<ProbeInfo> {
  const { stdout } = await runProcess(
    cfg.ffprobePath,
    ["-v", "error", ...inputOptions(input), "-print_format", "json", "-show_format", "-show_streams", "-i", input],
    Math.min(cfg.timeoutMs, 120_000),
  );
  const raw = JSON.parse(stdout) as RawProbe;
  const streams = raw.streams ?? [];
  const v = streams.find((s) => s.codec_type === "video" && !s.disposition?.attached_pic);
  const a = streams.find((s) => s.codec_type === "audio");
  const duration = Number(raw.format?.duration);
  return {
    formatName: raw.format?.format_name ?? "",
    durationMs: Number.isFinite(duration) ? Math.round(duration * 1000) : 0,
    bitRate: raw.format?.bit_rate ? Number(raw.format.bit_rate) || null : null,
    video: v
      ? {
          codec: v.codec_name ?? "desconhecido",
          width: v.width ?? 0,
          height: v.height ?? 0,
          fps: parseRate(v.avg_frame_rate) ?? parseRate(v.r_frame_rate),
        }
      : null,
    audio: a ? { codec: a.codec_name ?? "desconhecido", channels: a.channels ?? null } : null,
  };
}

// ─── Validação de formato ────────────────────────────────────────────────────

/** Codecs de vídeo aceitos no MVP (cobrem câmeras, celulares e exportações comuns). */
export const SUPPORTED_VIDEO_CODECS = ["h264", "hevc", "mpeg4"] as const;

/** Assinatura ISO-BMFF/QuickTime: um "atom" conhecido nos bytes 4–8. */
export function hasIsoBmffSignature(head: Buffer): boolean {
  if (head.length < 12) return false;
  const atom = head.subarray(4, 8).toString("latin1");
  return ["ftyp", "moov", "mdat", "wide", "free", "skip", "pnot"].includes(atom);
}

export type ProbeVerdict = { ok: true } | { ok: false; reason: string };

export function validateProbe(info: ProbeInfo, limits: { maxDurationMs: number }): ProbeVerdict {
  const formats = info.formatName.split(",");
  if (!formats.includes("mov") && !formats.includes("mp4")) {
    return { ok: false, reason: "O arquivo não é um vídeo MP4 ou MOV válido." };
  }
  if (!info.video) return { ok: false, reason: "Não encontramos uma faixa de vídeo no arquivo." };
  if (!(SUPPORTED_VIDEO_CODECS as readonly string[]).includes(info.video.codec)) {
    return {
      ok: false,
      reason: `Codec de vídeo não suportado (${info.video.codec}). Exporte o vídeo em H.264 ou H.265 e envie novamente.`,
    };
  }
  if (info.video.width <= 0 || info.video.height <= 0) {
    return { ok: false, reason: "Não foi possível ler a resolução do vídeo." };
  }
  if (info.durationMs <= 0) return { ok: false, reason: "Não foi possível ler a duração do vídeo." };
  if (info.durationMs > limits.maxDurationMs) {
    const max = Math.round(limits.maxDurationMs / 60_000);
    return { ok: false, reason: `O vídeo é mais longo que o limite atual de ${max} minutos.` };
  }
  return { ok: true };
}

// ─── Corte ───────────────────────────────────────────────────────────────────

export type CutMode = "PRECISE" | "FAST";

function seconds(ms: number): string {
  if (!Number.isInteger(ms) || ms < 0) throw new Error("Tempo inválido");
  return (ms / 1000).toFixed(3);
}

/** Monta os argumentos do FFmpeg para um corte. Exportado para testes. */
export function buildCutArgs(opts: {
  input: string;
  output: string;
  startMs: number;
  endMs: number;
  mode: CutMode;
  threads: number;
}): string[] {
  if (opts.endMs <= opts.startMs) throw new Error("Intervalo inválido");
  const common = [
    "-hide_banner",
    "-nostdin",
    "-y",
    "-loglevel",
    "error",
    ...inputOptions(opts.input),
    // -ss antes de -i: busca rápida; com recodificação o corte continua exato no quadro.
    "-ss",
    seconds(opts.startMs),
    "-i",
    opts.input,
    "-t",
    seconds(opts.endMs - opts.startMs),
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    "-sn",
    "-dn",
    "-map_metadata",
    "-1",
    "-threads",
    String(opts.threads),
  ];
  const video =
    opts.mode === "PRECISE"
      ? ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-profile:v", "high"]
      : ["-c:v", "copy"];
  // Áudio sempre em AAC: compatível com MP4 em qualquer reprodutor (barato de recodificar).
  const audio = ["-c:a", "aac", "-b:a", "160k", "-ac", "2"];
  return [
    ...common,
    ...video,
    ...audio,
    "-avoid_negative_ts",
    "make_zero",
    "-movflags",
    "+faststart",
    "-max_muxing_queue_size",
    "1024",
    "-f",
    "mp4",
    opts.output,
  ];
}

export async function cutClip(
  opts: { input: string; output: string; startMs: number; endMs: number; mode: CutMode },
  cfg: FfmpegConfig,
): Promise<void> {
  await runProcess(cfg.ffmpegPath, buildCutArgs({ ...opts, threads: cfg.threads }), cfg.timeoutMs);
}

/** Probe de um arquivo gerado por nós (saída local) — sem forçar demuxer de entrada. */
export async function probeOutput(path: string, cfg: FfmpegConfig): Promise<ProbeInfo> {
  return probe(path, cfg);
}
