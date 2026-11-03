import { asRecord, str } from "./json.js";

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export function redact(text: string, secret: string): string {
  if (!secret) return text;
  return text.split(secret).join("");
}

export function readCode(body: unknown): string | undefined {
  const record = asRecord(body);
  if (!record) return undefined;
  const top = str(record.code);
  if (top) return top;
  return str(asRecord(record.error)?.code);
}

function readDetails(body: unknown): Record<string, unknown> | undefined {
  const record = asRecord(body);
  if (!record) return undefined;
  return asRecord(record.details) ?? asRecord(asRecord(record.error)?.details);
}

function readMessage(body: unknown): string | undefined {
  const record = asRecord(body);
  if (!record) return undefined;
  return str(record.message) ?? str(asRecord(record.error)?.message);
}

/** Segundos de espera do RL02, já limitado a 120. Null quando não é rate limit. */
export function readRateLimitWait(body: unknown): number | null {
  if (readCode(body) !== "RL02") return null;
  const raw = readDetails(body)?.retry_after;
  const parsed = typeof raw === "number" ? raw : Number(raw);
  const seconds = Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
  return Math.min(seconds, 120);
}

export function translateApiError(status: number, bodyText: string, apiKey: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    parsed = undefined;
  }
  const code = readCode(parsed);
  if (code === "ARU5") {
    return "O card não atende às regras de chegada da coluna de destino.";
  }
  if (code === "C191") {
    return "Falta cumprir os critérios de saída da coluna atual.";
  }
  if (code === "RL02") {
    return "Limite de requisições da API (RL02). Tente de novo mais tarde.";
  }
  const short = redact(readMessage(parsed) ?? "", apiKey).replace(/\s+/g, " ").trim().slice(0, 180);
  if (code && short) return `Erro ${code} (HTTP ${status}): ${short}`;
  if (code) return `Erro ${code} (HTTP ${status}).`;
  return `Erro HTTP ${status}.`;
}
