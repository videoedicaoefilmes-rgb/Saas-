/**
 * Nomes de arquivo seguros e padronizados.
 * Nunca usados como caminho no armazenamento — apenas como nome de download.
 */

/** "João da Silva / Sub-15" → "joao_da_silva_sub-15" */
export function slugifyPart(value: string | null | undefined, maxLength = 40): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_-]+|[_-]+$/g, "")
    .slice(0, maxLength)
    .replace(/[_-]+$/g, "");
}

/** atleta_partida_lance_001.mp4 (partes vazias são omitidas). */
export function clipFilename(opts: {
  athleteName?: string | null;
  matchName?: string | null;
  projectName?: string | null;
  position: number;
}): string {
  const parts = [slugifyPart(opts.athleteName), slugifyPart(opts.matchName)].filter(Boolean);
  if (parts.length === 0) {
    const project = slugifyPart(opts.projectName);
    if (project) parts.push(project);
  }
  parts.push(`lance_${String(opts.position).padStart(3, "0")}`);
  return `${parts.join("_")}.mp4`;
}

export function zipFilename(opts: { athleteName?: string | null; matchName?: string | null; projectName?: string | null }): string {
  const parts = [slugifyPart(opts.athleteName), slugifyPart(opts.matchName)].filter(Boolean);
  if (parts.length === 0) parts.push(slugifyPart(opts.projectName) || "projeto");
  return `${parts.join("_")}_lances.zip`;
}

/** Nome original apenas para exibição: remove caminhos e caracteres de controle. */
export function sanitizeDisplayFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "").trim();
  return (cleaned || "video").slice(0, 200);
}

/** Extensão permitida a partir do nome (validação preliminar; o formato real é checado no servidor). */
export function allowedVideoExtension(name: string): "mp4" | "mov" | null {
  const ext = name.toLowerCase().split(".").pop();
  if (ext === "mp4" || ext === "m4v") return "mp4";
  if (ext === "mov") return "mov";
  return null;
}
