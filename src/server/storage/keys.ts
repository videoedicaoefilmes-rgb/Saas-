/**
 * Layout das chaves no armazenamento. Somente IDs gerados pelo servidor (cuid) compõem
 * as chaves, o que elimina path traversal e colisões, e permite apagar tudo de um
 * usuário pelo prefixo `users/{userId}/`.
 */
const ID = /^[a-z0-9]{8,64}$/i;
const SAFE_KEY = /^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+(?:\.[a-z0-9]{2,5})?$/;

function id(value: string): string {
  if (!ID.test(value)) throw new Error("Identificador inválido para chave de armazenamento");
  return value;
}

export function userPrefix(userId: string): string {
  return `users/${id(userId)}/`;
}

export function projectPrefix(userId: string, projectId: string): string {
  return `${userPrefix(userId)}projects/${id(projectId)}/`;
}

export function sourceKey(userId: string, projectId: string, assetId: string, ext: "mp4" | "mov"): string {
  return `${projectPrefix(userId, projectId)}source/${id(assetId)}.${ext}`;
}

export function exportKey(userId: string, projectId: string, jobId: string, exportId: string): string {
  return `${projectPrefix(userId, projectId)}jobs/${id(jobId)}/${id(exportId)}.mp4`;
}

export function assertSafeKey(key: string): void {
  if (!SAFE_KEY.test(key) || key.includes("..") || key.length > 512) {
    throw new Error("Chave de armazenamento inválida");
  }
}

export function assertSafePrefix(prefix: string): void {
  if (!prefix.endsWith("/")) throw new Error("Prefixo deve terminar com /");
  assertSafeKey(prefix.slice(0, -1));
}
