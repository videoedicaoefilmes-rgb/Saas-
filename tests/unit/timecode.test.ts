import { describe, expect, it } from "vitest";
import { formatTimecode, parseTimecode } from "@/lib/timecode";

const ms = (input: string) => {
  const r = parseTimecode(input);
  if (!r.ok) throw new Error(r.error);
  return r.ms;
};

describe("parseTimecode", () => {
  it("converte MM:SS (exemplo do briefing)", () => {
    expect(ms("12:35")).toBe(755_000);
    expect(ms("12:52")).toBe(772_000);
    expect(ms("34:10")).toBe(2_050_000);
  });
  it("aceita minutos acima de 59 em MM:SS (2º tempo)", () => {
    expect(ms("95:20")).toBe(5_720_000);
  });
  it("converte HH:MM:SS", () => {
    expect(ms("1:02:03")).toBe(3_723_000);
    expect(ms("00:00:05")).toBe(5_000);
  });
  it("converte segundos simples", () => {
    expect(ms("95")).toBe(95_000);
    expect(ms("0")).toBe(0);
  });
  it("aceita frações com ponto ou vírgula", () => {
    expect(ms("12:35.5")).toBe(755_500);
    expect(ms("12:35,25")).toBe(755_250);
    expect(ms("1.234")).toBe(1_234);
  });
  it("ignora espaços nas pontas", () => {
    expect(ms("  12:35 ")).toBe(755_000);
  });
  it.each([
    ["", "Informe"],
    ["-5", "negativo"],
    ["-00:05", "negativo"],
    ["12:60", "segundos"],
    ["1:60:00", "minutos"],
    ["1:2:3:4", "Formato"],
    ["abc", "Formato"],
    ["12::35", "Formato"],
    ["12:3a", "Formato"],
    ["1e3", "Formato"],
    ["12:35.1234", "Formato"],
  ])("rejeita %j", (input, msg) => {
    const r = parseTimecode(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(msg);
  });
});

describe("formatTimecode", () => {
  it("formata minutos e horas", () => {
    expect(formatTimecode(755_000)).toBe("12:35");
    expect(formatTimecode(3_723_000)).toBe("1:02:03");
    expect(formatTimecode(5_720_000)).toBe("1:35:20");
    expect(formatTimecode(755_500)).toBe("12:35.5");
  });
  it("ida e volta preserva o valor (precisão de décimos)", () => {
    for (const v of [0, 1_000, 59_900, 755_500, 3_723_000]) expect(ms(formatTimecode(v))).toBe(v);
  });
});
