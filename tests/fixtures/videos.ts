import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Vídeos de teste gerados localmente pelo FFmpeg (padrão de barras + tom),
 * pequenos e sem pessoas — apropriados para testes automatizados.
 */
export const FIXTURES_DIR = path.resolve("tests/fixtures/generated");

export const fixtures = {
  /** 60 s, 320x180, H.264 + AAC, MP4, keyframe a cada 10 s (para evidenciar corte preciso vs rápido). */
  mp4: path.join(FIXTURES_DIR, "partida-60s.mp4"),
  /** 20 s, H.264, MOV, sem áudio. */
  movNoAudio: path.join(FIXTURES_DIR, "partida-20s-sem-audio.mov"),
  /** MOV com codec não suportado (MJPEG). */
  movMjpeg: path.join(FIXTURES_DIR, "codec-nao-suportado.mov"),
  /** Texto disfarçado de MP4. */
  fakeMp4: path.join(FIXTURES_DIR, "falso.mp4"),
};

function ff(args: string[]) {
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });
}

export function ensureFixtures(): void {
  mkdirSync(FIXTURES_DIR, { recursive: true });
  if (!existsSync(fixtures.mp4)) {
    ff([
      "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=15",
      "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100",
      "-t", "60", "-c:v", "libx264", "-preset", "veryfast", "-g", "150", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-shortest", fixtures.mp4,
    ]);
  }
  if (!existsSync(fixtures.movNoAudio)) {
    ff(["-f", "lavfi", "-i", "testsrc2=size=320x180:rate=15", "-t", "20", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", fixtures.movNoAudio]);
  }
  if (!existsSync(fixtures.movMjpeg)) {
    ff(["-f", "lavfi", "-i", "testsrc2=size=160x90:rate=10", "-t", "3", "-c:v", "mjpeg", fixtures.movMjpeg]);
  }
  if (!existsSync(fixtures.fakeMp4)) {
    writeFileSync(fixtures.fakeMp4, "isto não é um vídeo ".repeat(100));
  }
}
