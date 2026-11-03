import { DomainError } from "./errors.js";

const VALUE_TYPES = new Set(["single_line_text", "multi_line_text", "number", "date", "link"]);

const PRIORITY = new Map<string, number>([
  ["critica", 1],
  ["critical", 1],
  ["alta", 2],
  ["high", 2],
  ["media", 3],
  ["average", 3],
  ["baixa", 4],
  ["low", 4],
]);

export interface FieldInput {
  fieldId: number;
  name: string;
  type: string;
  valor: string;
  valueId?: number;
}

export function parsePriority(value: string): number {
  const trimmed = value.trim();
  if (/^[1-4]$/.test(trimmed)) return Number(trimmed);
  const key = trimmed.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const found = PRIORITY.get(key);
  if (found === undefined) throw new DomainError("Prioridade inválida. Use Crítica, Alta, Média, Baixa ou 1 a 4.");
  return found;
}

export function priorityLabel(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value);
  if (n === 1) return "Crítica";
  if (n === 2) return "Alta";
  if (n === 3) return "Média";
  if (n === 4) return "Baixa";
  return "";
}

export function fieldToApi(field: FieldInput): Record<string, unknown> {
  if (field.type === "dropdown") {
    if (!field.valueId) throw new DomainError(`Campo "${field.name}" sem value_id.`);
    return {
      field_id: field.fieldId,
      selected_values_to_add_or_update: [{ value_id: field.valueId }],
    };
  }
  if (!VALUE_TYPES.has(field.type)) {
    throw new DomainError(`Campo "${field.name}" do tipo ${field.type} não é suportado nesta versão.`);
  }
  return { field_id: field.fieldId, value: field.valor };
}

export function buildLoggedTimeCreate(input: {
  cardId: number;
  seconds: number;
  date: string;
  comment?: string;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    card_id: input.cardId,
    time: input.seconds,
    date: input.date,
  };
  if (input.comment !== undefined) body.comment = input.comment;
  return body;
}

export function buildLoggedTimePatch(input: {
  seconds?: number;
  date?: string;
  comment?: string;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (input.seconds !== undefined) body.time = input.seconds;
  if (input.date !== undefined) body.date = input.date;
  if (input.comment !== undefined) body.comment = input.comment;
  if (Object.keys(body).length === 0) throw new DomainError("Nada para alterar no lançamento.");
  return body;
}

export function buildCreateCard(input: {
  columnId: number;
  laneId: number;
  title: string;
  description?: string;
  typeId?: number;
  priority?: number;
  fields?: FieldInput[];
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    column_id: input.columnId,
    lane_id: input.laneId,
    title: input.title,
  };
  if (input.description !== undefined) body.description = input.description;
  if (input.typeId !== undefined) body.type_id = input.typeId;
  if (input.priority !== undefined) body.priority = input.priority;
  if (input.fields && input.fields.length > 0) {
    body.custom_fields_to_add_or_update = input.fields.map(fieldToApi);
  }
  return body;
}

export function buildUpdateCard(input: {
  title?: string;
  description?: string;
  typeId?: number;
  priority?: number;
  fields?: FieldInput[];
}): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (input.title !== undefined) body.title = input.title;
  if (input.description !== undefined) body.description = input.description;
  if (input.typeId !== undefined) body.type_id = input.typeId;
  if (input.priority !== undefined) body.priority = input.priority;
  if (input.fields && input.fields.length > 0) {
    body.custom_fields_to_add_or_update = input.fields.map(fieldToApi);
  }
  if (Object.keys(body).length === 0) throw new DomainError("Nada para atualizar.");
  return body;
}
