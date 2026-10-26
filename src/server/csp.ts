/**
 * Content-Security-Policy calculada EM EXECUÇÃO (não no build): depende do armazenamento
 * configurado, para que o navegador possa enviar/reproduzir vídeos direto do S3.
 * Importado pelo proxy — não pode depender de módulos de servidor pesados.
 */
function storageOrigins(): string {
  if (process.env.STORAGE_DRIVER !== "s3") return "";
  const endpoint = process.env.S3_PUBLIC_ENDPOINT || process.env.S3_ENDPOINT;
  if (!endpoint) return "https://*.amazonaws.com";
  try {
    const url = new URL(endpoint);
    // Endpoints com o bucket no subdomínio (virtual-hosted) também precisam ser aceitos.
    return `${url.origin} ${url.protocol}//*.${url.host}`;
  } catch {
    return "";
  }
}

let cached: string | null = null;

export function contentSecurityPolicy(): string {
  if (cached) return cached;
  const isDev = process.env.NODE_ENV !== "production";
  const storage = storageOrigins();
  cached = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `media-src 'self' blob: ${storage}`.trim(),
    `connect-src 'self' ${storage}`.trim(),
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");
  return cached;
}
