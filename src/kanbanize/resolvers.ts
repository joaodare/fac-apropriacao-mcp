import { DomainError } from "./errors.js";
import { asRecord, num, str } from "./json.js";

export interface NamedRef {
  id: number;
  name: string;
  workflowId?: number;
}

export interface FieldDef {
  id: number;
  name: string;
  type: string;
}

export interface AllowedRow {
  valueId: number;
  text?: string;
  enabled: boolean;
}

export interface DropdownOption {
  valueId: number;
  text: string;
}

export function lastSegment(name: string): string {
  const trimmed = name.trim();
  const index = trimmed.lastIndexOf(".");
  return index >= 0 ? trimmed.slice(index + 1).trim() : trimmed;
}

function norm(value: string): string {
  return value.trim().toLowerCase();
}

export function resolveByName(
  items: NamedRef[],
  query: string,
  kind: string,
  workflowId?: number,
): NamedRef {
  const q = query.trim();
  if (!q) throw new DomainError(`${kind} sem nome.`);
  const pool = workflowId === undefined ? items : items.filter((item) => item.workflowId === workflowId);
  const exact = pool.filter((item) => norm(item.name) === norm(q));
  let chosen = exact;
  if (chosen.length === 0 && q.includes(".")) {
    const ultimo = lastSegment(q);
    chosen = pool.filter((item) => norm(item.name) === norm(ultimo));
  }
  if (chosen.length === 0) throw new DomainError(`${kind} "${q}" não encontrado.`);
  if (chosen.length > 1) {
    const list = chosen.map((item) => `${item.name} (#${item.id})`).join(", ");
    throw new DomainError(`${kind} "${q}" corresponde a mais de um item: ${list}.`);
  }
  const found = chosen[0];
  if (!found) throw new DomainError(`${kind} "${q}" não encontrado.`);
  return found;
}

export function parseStructureSide(value: unknown, idKeys: string[]): NamedRef[] {
  const rows: { keyId?: number; item: unknown }[] = Array.isArray(value)
    ? value.map((item) => ({ item }))
    : objectRows(value);
  const out: NamedRef[] = [];
  for (const row of rows) {
    const record = asRecord(row.item);
    if (!record) continue;
    const id = firstNum(record, idKeys) ?? row.keyId;
    const name = str(record.name);
    if (!id || !name) continue;
    const workflowId = num(record.workflow_id);
    out.push(workflowId ? { id, name, workflowId } : { id, name });
  }
  return out;
}

function objectRows(value: unknown): { keyId?: number; item: unknown }[] {
  const record = asRecord(value);
  if (!record) return [];
  return Object.entries(record).map(([key, item]) => ({ keyId: num(key), item }));
}

function firstNum(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = num(record[key]);
    if (value) return value;
  }
  return undefined;
}

export function parseFieldDefs(rows: unknown[]): FieldDef[] {
  const out: FieldDef[] = [];
  for (const row of rows) {
    const record = asRecord(row);
    if (!record) continue;
    const id = num(record.field_id);
    const name = str(record.name);
    const type = str(record.type) ?? "";
    if (!id || !name) continue;
    out.push({ id, name, type });
  }
  return out;
}

export function parseAllowed(rows: unknown[]): AllowedRow[] {
  const out: AllowedRow[] = [];
  for (const row of rows) {
    const record = asRecord(row);
    if (!record) continue;
    const valueId = num(record.value_id);
    if (!valueId) continue;
    const text = str(record.value);
    const enabled = record.is_enabled === undefined || num(record.is_enabled) === 1;
    out.push(text ? { valueId, text, enabled } : { valueId, enabled });
  }
  return out;
}

export function joinDropdownOptions(boardRows: AllowedRow[], globalRows: AllowedRow[]): DropdownOption[] {
  const globalById = new Map(globalRows.map((row) => [row.valueId, row]));
  if (boardRows.length === 0) {
    return globalRows.flatMap((row) => (row.enabled && row.text ? [{ valueId: row.valueId, text: row.text }] : []));
  }
  const out: DropdownOption[] = [];
  for (const row of boardRows) {
    if (!row.enabled) continue;
    const text = row.text ?? globalById.get(row.valueId)?.text;
    if (!text) continue;
    out.push({ valueId: row.valueId, text });
  }
  return out;
}

export function resolveOptionId(options: DropdownOption[], text: string): number {
  const query = text.trim().toLowerCase();
  const matches = options.filter((option) => option.text.trim().toLowerCase() === query);
  if (matches.length === 0) throw new DomainError(`Opção "${text}" não encontrada no dropdown.`);
  if (matches.length > 1) {
    throw new DomainError(`Opção "${text}" é ambígua no dropdown: ${matches.map((item) => item.valueId).join(", ")}.`);
  }
  const found = matches[0];
  if (!found) throw new DomainError(`Opção "${text}" não encontrada no dropdown.`);
  return found.valueId;
}

export interface Placement {
  columnId: number;
  laneId: number;
}

export function resolvePlacement(
  columns: NamedRef[],
  lanes: NamedRef[],
  coluna: string,
  raia: string,
): Placement {
  const lane = resolveByName(lanes, raia, "Raia");
  const column = resolveByName(columns, coluna, "Coluna", lane.workflowId);
  if (column.workflowId && lane.workflowId && column.workflowId !== lane.workflowId) {
    throw new DomainError("Coluna e raia estão em workflows diferentes.");
  }
  return { columnId: column.id, laneId: lane.id };
}
