/**
 * Regra de cobrança — módulo isolado e puro (sem banco, sem I/O), para ser ajustado
 * sem tocar no restante do sistema.
 *
 * Unidade de cobrança: minutos de vídeo PROCESSADO (soma dos lances com margens),
 * não a duração total do vídeo enviado.
 *
 *   segundosCobráveis = Σ ceil(duraçãoEfetivaDoLance / 1000)
 *   unidades          = ceil(segundosCobráveis / unitSeconds)
 *   créditos          = max(minCredits, unidades × creditsPerUnit)
 *
 * Os parâmetros vêm das configurações (env + painel admin). Nenhum preço em reais é
 * definido aqui: a conversão crédito → R$ pertence aos planos (tabela Plan).
 */

export type PricingRule = {
  /** Versão da regra, gravada em cada cobrança para auditoria. */
  version: 1;
  unitSeconds: number;
  creditsPerUnit: number;
  minCredits: number;
};

export type PricingEstimate = {
  clipCount: number;
  billableSeconds: number;
  units: number;
  credits: number;
  rule: PricingRule;
};

export function estimateCredits(clipDurationsMs: readonly number[], rule: PricingRule): PricingEstimate {
  if (rule.unitSeconds <= 0 || rule.creditsPerUnit <= 0 || rule.minCredits < 0) {
    throw new Error("Regra de cobrança inválida");
  }
  let billableSeconds = 0;
  for (const ms of clipDurationsMs) {
    if (!Number.isFinite(ms) || ms <= 0) throw new Error("Duração de lance inválida");
    billableSeconds += Math.ceil(ms / 1000);
  }
  const units = Math.ceil(billableSeconds / rule.unitSeconds);
  const credits = clipDurationsMs.length === 0 ? 0 : Math.max(rule.minCredits, units * rule.creditsPerUnit);
  return { clipCount: clipDurationsMs.length, billableSeconds, units, credits, rule };
}

/** Estimativa de custo de infraestrutura (centavos) — só quando a taxa real foi configurada. */
export function estimateInfraCostCents(processingMs: number, centsPerProcessingMinute: number | null): number | null {
  if (centsPerProcessingMinute === null) return null;
  return Math.ceil((processingMs / 60_000) * centsPerProcessingMinute);
}
