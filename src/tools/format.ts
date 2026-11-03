import { priorityLabel } from "../kanbanize/bodies.js";
import { asRecord, num, str } from "../kanbanize/json.js";
import { secondsToHours } from "../kanbanize/time.js";
import type { FieldDef } from "../kanbanize/resolvers.js";

export interface CardLabels {
  board?: string;
  column?: string;
  lane?: string;
  owner?: string;
  fields?: { name: string; value: string }[];
  hours?: number;
}

export function formatCard(card: Record<string, unknown>, labels: CardLabels = {}): string {
  const id = num(card.card_id) ?? "?";
  const title = str(card.title) ?? "";
  const lines = [`Card ${id} — ${title}`];
  const board = labels.board ?? (num(card.board_id) ? String(num(card.board_id)) : "");
  if (board) lines.push(`Board: ${board}`);
  const column = labels.column ?? (num(card.column_id) ? String(num(card.column_id)) : "");
  if (column) lines.push(`Coluna: ${column}`);
  const lane = labels.lane ?? (num(card.lane_id) ? String(num(card.lane_id)) : "");
  if (lane) lines.push(`Raia: ${lane}`);
  const owner = labels.owner ?? (num(card.owner_user_id) ? `usuário ${num(card.owner_user_id)}` : "");
  if (owner) lines.push(`Dono: ${owner}`);
  const priority = priorityLabel(card.priority);
  if (priority) lines.push(`Prioridade: ${priority}`);
  if (labels.fields && labels.fields.length > 0) {
    lines.push(`Campos: ${labels.fields.map((field) => `${field.name}=${field.value}`).join("; ")}`);
  }
  if (labels.hours !== undefined) lines.push(`Horas: ${labels.hours}`);
  return lines.join("\n");
}

export function cardFieldLines(card: Record<string, unknown>, fields: FieldDef[]): { name: string; value: string }[] {
  const byId = new Map(fields.map((field) => [field.id, field.name]));
  const raw = Array.isArray(card.custom_fields) ? card.custom_fields : [];
  const out: { name: string; value: string }[] = [];
  for (const item of raw) {
    const record = asRecord(item);
    if (!record) continue;
    const id = num(record.field_id);
    const name = (id && byId.get(id)) || (id ? `campo ${id}` : "campo");
    const value = displayCustomValue(record);
    if (value) out.push({ name, value });
  }
  return out;
}

export function fieldValueHas(
  card: Record<string, unknown>,
  fields: FieldDef[],
  namePattern: RegExp,
  expected: string,
): boolean {
  const ids = new Set(fields.filter((field) => namePattern.test(field.name)).map((field) => field.id));
  if (ids.size === 0) return false;
  const needle = expected.trim().toLowerCase();
  const raw = Array.isArray(card.custom_fields) ? card.custom_fields : [];
  for (const item of raw) {
    const record = asRecord(item);
    if (!record) continue;
    const id = num(record.field_id);
    if (!id || !ids.has(id)) continue;
    if (displayCustomValue(record).toLowerCase().includes(needle)) return true;
  }
  return false;
}

export function loggedHours(card: Record<string, unknown>): number | undefined {
  const seconds = num(card.current_logged_time);
  if (seconds === undefined) return undefined;
  return secondsToHours(seconds);
}

function displayCustomValue(record: Record<string, unknown>): string {
  const direct = str(record.display_value) ?? str(record.value);
  if (direct) return direct;
  if (!Array.isArray(record.values)) return "";
  const parts: string[] = [];
  for (const item of record.values) {
    const value = asRecord(item);
    if (!value) continue;
    const text = str(value.value) ?? (num(value.value_id) ? `#${num(value.value_id)}` : undefined);
    if (text) parts.push(text);
  }
  return parts.join(", ");
}
