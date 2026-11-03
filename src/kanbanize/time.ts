import { DomainError } from "./errors.js";

export const MIN_HOURS = 0.01;
export const MIN_SECONDS = 36;
export const MAX_SECONDS = 6_000_000;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function todayInSaoPaulo(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function hoursToSeconds(hours: number): number {
  if (!Number.isFinite(hours) || hours < MIN_HOURS) {
    throw new DomainError("O mínimo é 0,01 hora (36 segundos).");
  }
  const seconds = Math.round(hours * 3600);
  if (seconds < MIN_SECONDS) {
    throw new DomainError("O mínimo é 0,01 hora (36 segundos).");
  }
  if (seconds > MAX_SECONDS) {
    throw new DomainError("O máximo é 6.000.000 segundos.");
  }
  return seconds;
}

export function secondsToHours(seconds: number): number {
  return Math.round((seconds / 3600) * 100) / 100;
}

export function assertWorkDate(date: string, now: Date = new Date()): string {
  const match = DATE_RE.exec(date.trim());
  if (!match) throw new DomainError("Data inválida. Use YYYY-MM-DD.");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) {
    throw new DomainError("Data inválida. Use YYYY-MM-DD.");
  }
  const today = todayInSaoPaulo(now);
  if (date.trim() > today) {
    throw new DomainError("Data futura não é permitida (fuso America/Sao_Paulo).");
  }
  return date.trim();
}
