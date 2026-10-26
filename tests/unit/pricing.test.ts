import { describe, expect, it } from "vitest";
import { estimateCredits, estimateInfraCostCents, type PricingRule } from "@/lib/billing/pricing";

const rule: PricingRule = { version: 1, unitSeconds: 60, creditsPerUnit: 1, minCredits: 1 };

describe("estimateCredits", () => {
  it("cobra por minuto processado iniciado", () => {
    expect(estimateCredits([17_000, 18_000, 25_000], rule)).toMatchObject({ billableSeconds: 60, units: 1, credits: 1 });
    expect(estimateCredits([30_000, 31_000], rule)).toMatchObject({ billableSeconds: 61, units: 2, credits: 2 });
  });
  it("arredonda frações de segundo para cima por lance", () => {
    expect(estimateCredits([1_001, 1_001], rule).billableSeconds).toBe(4);
  });
  it("aplica cobrança mínima", () => {
    expect(estimateCredits([2_000], { ...rule, minCredits: 3 }).credits).toBe(3);
  });
  it("respeita créditos por unidade e unidade configurável", () => {
    expect(estimateCredits([120_000], { ...rule, unitSeconds: 30, creditsPerUnit: 2 }).credits).toBe(8);
  });
  it("lista vazia custa zero", () => {
    expect(estimateCredits([], rule).credits).toBe(0);
  });
  it("rejeita durações e regras inválidas", () => {
    expect(() => estimateCredits([0], rule)).toThrow();
    expect(() => estimateCredits([1000], { ...rule, unitSeconds: 0 })).toThrow();
  });
});

describe("estimateInfraCostCents", () => {
  it("não inventa custo quando a taxa não foi configurada", () => {
    expect(estimateInfraCostCents(120_000, null)).toBeNull();
  });
  it("calcula pela taxa configurada", () => {
    expect(estimateInfraCostCents(90_000, 10)).toBe(15);
  });
});
