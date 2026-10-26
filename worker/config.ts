import { getEnv } from "@/server/env";
import type { FfmpegConfig } from "@/server/media/ffmpeg";

export function ffmpegConfig(): FfmpegConfig {
  const env = getEnv();
  return {
    ffmpegPath: env.FFMPEG_PATH,
    ffprobePath: env.FFPROBE_PATH,
    threads: env.FFMPEG_THREADS,
    timeoutMs: env.FFMPEG_TIMEOUT_SECONDS * 1000,
  };
}
