import { buildCreateCard, buildUpdateCard, parsePriority, priorityLabel, type FieldInput } from "../kanbanize/bodies.js";
import { assertCardOnFixedBoard, fixedBoard, getCard, loadDropdownRows, loadFields, loadStructure, loadTypes } from "../kanbanize/catalog.js";
import { KanbanizeClient } from "../kanbanize/client.js";
import { DomainError } from "../kanbanize/errors.js";
import { num, oneOf, str } from "../kanbanize/json.js";
import { joinDropdownOptions, resolveByName, resolveOptionId, resolvePlacement } from "../kanbanize/resolvers.js";
import { formatCard } from "./format.js";

export interface CampoInput {
  nome: string;
  valor: string;
}

export async function criarCard(
  client: KanbanizeClient,
  args: {
    titulo: string;
    coluna: string;
    raia: string;
    tipo?: string;
    prioridade?: string;
    descricao?: string;
    campos?: CampoInput[];
  },
): Promise<string> {
  const boardId = (await fixedBoard(client)).id;
  const structure = await loadStructure(client, boardId);
  const place = resolvePlacement(structure.columns, structure.lanes, args.coluna, args.raia);
  const typeId = args.tipo ? resolveByName(await loadTypes(client, boardId), args.tipo, "Tipo").id : undefined;
  const priority = args.prioridade ? parsePriority(args.prioridade) : undefined;
  const fields = await resolveFieldInputs(client, boardId, args.campos);
  const body = buildCreateCard({
    columnId: place.columnId,
    laneId: place.laneId,
    title: args.titulo,
    description: args.descricao,
    typeId,
    priority,
    fields,
  });
  const created = oneOf(await client.post("/cards", body)) ?? {};
  return formatCard(
    {
      ...created,
      card_id: num(created.card_id),
      title: str(created.title) ?? args.titulo,
      board_id: num(created.board_id) ?? boardId,
      column_id: num(created.column_id) ?? place.columnId,
      lane_id: num(created.lane_id) ?? place.laneId,
      priority: created.priority ?? priority,
    },
    {
      board: structure.boardName ?? String(boardId),
      column: structure.columns.find((column) => column.id === place.columnId)?.name ?? args.coluna,
      lane: structure.lanes.find((lane) => lane.id === place.laneId)?.name ?? args.raia,
      fields: fields.map((field) => ({ name: field.name, value: field.valor })),
    },
  );
}

export async function atualizarCard(
  client: KanbanizeClient,
  args: {
    cardId: number;
    titulo?: string;
    descricao?: string;
    tipo?: string;
    prioridade?: string;
    campos?: CampoInput[];
  },
): Promise<string> {
  const current = await getCard(client, args.cardId);
  const boardId = (await assertCardOnFixedBoard(client, args.cardId, num(current.board_id))).id;
  const typeId = args.tipo ? resolveByName(await loadTypes(client, boardId), args.tipo, "Tipo").id : undefined;
  const priority = args.prioridade ? parsePriority(args.prioridade) : undefined;
  const fields = await resolveFieldInputs(client, boardId, args.campos);
  const body = buildUpdateCard({
    title: args.titulo,
    description: args.descricao,
    typeId,
    priority,
    fields,
  });
  await client.patch(`/cards/${args.cardId}`, body);
  const lines = [`Card ${args.cardId} atualizado.`];
  if (args.titulo !== undefined) lines.push(`Título: ${args.titulo}`);
  if (args.descricao !== undefined) lines.push("Descrição atualizada.");
  if (priority !== undefined) lines.push(`Prioridade: ${priorityLabel(priority)}`);
  if (args.tipo) lines.push(`Tipo: ${args.tipo}`);
  if (fields.length > 0) {
    lines.push(`Campos: ${fields.map((field) => `${field.name}=${field.valor}`).join("; ")}`);
  }
  return lines.join("\n");
}

async function resolveFieldInputs(
  client: KanbanizeClient,
  boardId: number,
  campos: CampoInput[] | undefined,
): Promise<FieldInput[]> {
  if (!campos || campos.length === 0) return [];
  const fields = await loadFields(client, boardId);
  const named = fields.map((field) => ({ id: field.id, name: field.name }));
  const out: FieldInput[] = [];
  for (const campo of campos) {
    const match = resolveByName(named, campo.nome, "Campo");
    const field = fields.find((item) => item.id === match.id);
    if (!field) throw new DomainError(`Campo "${campo.nome}" não encontrado.`);
    if (field.type === "dropdown") {
      const rows = await loadDropdownRows(client, boardId, field.id);
      const valueId = resolveOptionId(joinDropdownOptions(rows.board, rows.global), campo.valor);
      out.push({ fieldId: field.id, name: field.name, type: field.type, valor: campo.valor, valueId });
    } else {
      out.push({ fieldId: field.id, name: field.name, type: field.type, valor: campo.valor });
    }
  }
  return out;
}
