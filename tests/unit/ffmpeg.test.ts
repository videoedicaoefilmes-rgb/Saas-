import { describe, expect, it } from "vitest";
import { buildCutArgs, hasIsoBmffSignature, validateProbe, type ProbeInfo } from "@/server/media/ffmpeg";

describe("buildCutArgs", () => {
  const base = { input: "/data/in.mp4", output: "/tmp/out.mp4", startMs: 755_000, endMs: 772_000, threads: 2 };

  it("modo preciso recodifica e usa tempos com milissegundos", () => {
    const args = buildCutArgs({ ...base, mode: "PRECISE" });
    expect(args).toContain("libx264");
    expect(args[args.indexOf("-ss") + 1]).toBe("755.000");
    expect(args[args.indexOf("-t") + 1]).toBe("17.000");
    expect(args.slice(-3)).toEqual(["-f", "mp4", "/tmp/out.mp4"]);
  });
  it("modo rápido copia o vídeo", () => {
    const args = buildCutArgs({ ...base, mode: "FAST" });
    expect(args[args.indexOf("-c:v") + 1]).toBe("copy");
  });
  it("entrada local só permite o protocolo file e força o demuxer mov", () => {
    const args = buildCutArgs({ ...base, mode: "PRECISE" });
    expect(args[args.indexOf("-protocol_whitelist") + 1]).toBe("file");
    expect(args[args.indexOf("-f") + 1]).toBe("mov");
  });
  it("entrada remota só permite HTTPS/HTTP", () => {
    const args = buildCutArgs({ ...base, input: "https://bucket.example/obj?sig=1", mode: "PRECISE" });
    expect(args[args.indexOf("-protocol_whitelist") + 1]).toBe("https,http,tls,tcp,crypto");
  });
  it("rejeita tempos inválidos (nunca monta comando com valores arbitrários)", () => {
    expect(() => buildCutArgs({ ...base, startMs: -1, mode: "PRECISE" })).toThrow();
    expect(() => buildCutArgs({ ...base, startMs: 1.5, mode: "PRECISE" })).toThrow();
    expect(() => buildCutArgs({ ...base, endMs: 100, startMs: 200, mode: "PRECISE" })).toThrow();
  });
});

describe("hasIsoBmffSignature", () => {
  it("reconhece ftyp", () => {
    const buf = Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from("ftypisom"), Buffer.alloc(4)]);
    expect(hasIsoBmffSignature(buf)).toBe(true);
  });
  it("rejeita texto e arquivos curtos", () => {
    expect(hasIsoBmffSignature(Buffer.from("isto não é um vídeo"))).toBe(false);
    expect(hasIsoBmffSignature(Buffer.from([0, 0, 0]))).toBe(false);
  });
});

describe("validateProbe", () => {
  const ok: ProbeInfo = {
    formatName: "mov,mp4,m4a,3gp,3g2,mj2",
    durationMs: 60_000,
    bitRate: 1_000_000,
    video: { codec: "h264", width: 1920, height: 1080, fps: 30 },
    audio: { codec: "aac", channels: 2 },
  };
  it("aceita H.264 em MP4", () => expect(validateProbe(ok, { maxDurationMs: 3_600_000 })).toEqual({ ok: true }));
  it("rejeita codec não suportado", () => {
    const r = validateProbe({ ...ok, video: { ...ok.video!, codec: "mjpeg" } }, { maxDurationMs: 3_600_000 });
    expect(r.ok).toBe(false);
  });
  it("rejeita sem vídeo", () => expect(validateProbe({ ...ok, video: null }, { maxDurationMs: 3_600_000 }).ok).toBe(false));
  it("rejeita vídeo acima do limite", () => expect(validateProbe(ok, { maxDurationMs: 30_000 }).ok).toBe(false));
  it("rejeita outros formatos", () => expect(validateProbe({ ...ok, formatName: "matroska,webm" }, { maxDurationMs: 3_600_000 }).ok).toBe(false));
});
