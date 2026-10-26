import { describe, expect, it } from "vitest";
import { effectiveRange, validateClipRange } from "@/lib/clips";

const opts = { videoDurationMs: 60_000, maxClipMs: 300_000 };

describe("validateClipRange", () => {
  it("aceita intervalo válido", () => {
    expect(validateClipRange({ startMs: 10_000, endMs: 20_000 }, opts)).toBeNull();
    expect(validateClipRange({ startMs: 0, endMs: 60_000 }, opts)).toBeNull();
  });
  it("impede início negativo", () => {
    expect(validateClipRange({ startMs: -1, endMs: 5_000 }, opts)).toBe("NEGATIVE_START");
  });
  it("impede fim anterior ou igual ao início", () => {
    expect(validateClipRange({ startMs: 5_000, endMs: 5_000 }, opts)).toBe("END_NOT_AFTER_START");
    expect(validateClipRange({ startMs: 5_000, endMs: 4_000 }, opts)).toBe("END_NOT_AFTER_START");
  });
  it("impede intervalos fora da duração do vídeo", () => {
    expect(validateClipRange({ startMs: 50_000, endMs: 60_001 }, opts)).toBe("OUT_OF_BOUNDS");
  });
  it("sem duração conhecida, não checa o limite do vídeo", () => {
    expect(validateClipRange({ startMs: 50_000, endMs: 90_000 }, { videoDurationMs: null, maxClipMs: 300_000 })).toBeNull();
  });
  it("impede lances curtos ou longos demais", () => {
    expect(validateClipRange({ startMs: 0, endMs: 100 }, opts)).toBe("TOO_SHORT");
    expect(validateClipRange({ startMs: 0, endMs: 40_000 }, { ...opts, maxClipMs: 30_000 })).toBe("TOO_LONG");
  });
});

describe("effectiveRange", () => {
  it("aplica margens e limita à duração do vídeo", () => {
    expect(effectiveRange({ startMs: 10_000, endMs: 20_000 }, { beforeMs: 2_000, afterMs: 3_000 }, 60_000)).toEqual({ startMs: 8_000, endMs: 23_000 });
    expect(effectiveRange({ startMs: 1_000, endMs: 59_000 }, { beforeMs: 5_000, afterMs: 5_000 }, 60_000)).toEqual({ startMs: 0, endMs: 60_000 });
  });
});
