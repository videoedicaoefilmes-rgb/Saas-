import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const nf = new Intl.NumberFormat("pt-BR");
export function formatNumber(n: number): string {
  return nf.format(n);
}

export function formatBytes(bytes: number | bigint | null | undefined): string {
  const b = Number(bytes ?? 0);
  if (b < 1024) return `${b} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = b / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${units[i]}`;
}

const dtf = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const df = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" });

export function formatDateTime(d: Date | string | null | undefined): string {
  return d ? dtf.format(new Date(d)) : "—";
}

/** Para datas sem horário (ex.: data da partida, armazenada em UTC). */
export function formatDate(d: Date | string | null | undefined): string {
  return d ? df.format(new Date(d)) : "—";
}

export function credits(n: number): string {
  return `${formatNumber(n)} ${Math.abs(n) === 1 ? "crédito" : "créditos"}`;
}
