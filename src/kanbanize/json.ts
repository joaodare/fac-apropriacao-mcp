export function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

export function str(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

export function num(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return undefined;
}

export function dataOf(payload: unknown): unknown {
  const record = asRecord(payload);
  if (record && "data" in record) return record.data;
  return payload;
}

export function listOf(payload: unknown): unknown[] {
  const data = dataOf(payload);
  if (Array.isArray(data)) return data;
  const nested = asRecord(data);
  if (nested && Array.isArray(nested.data)) return nested.data;
  return [];
}

export function oneOf(payload: unknown): Record<string, unknown> | undefined {
  const data = dataOf(payload);
  if (Array.isArray(data)) return asRecord(data[0]);
  return asRecord(data);
}
