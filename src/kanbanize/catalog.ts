import { KanbanizeClient, type Query } from "./client.js";
import { DomainError } from "./errors.js";
import { asRecord, listOf, num, oneOf, str } from "./json.js";
import {
  parseAllowed,
  parseFieldDefs,
  parseStructureSide,
  resolveByName,
  type FieldDef,
  type NamedRef,
} from "./resolvers.js";

export async function listBoards(client: KanbanizeClient): Promise<NamedRef[]> {
  const payload = await client.get("/boards");
  return listOf(payload).flatMap((row) => {
    const record = asRecord(row);
    if (!record) return [];
    const id = num(record.board_id) ?? num(record.id);
    const name = str(record.name);
    if (!id || !name) return [];
    return [{ id, name }];
  });
}

export async function resolveBoardId(client: KanbanizeClient, board: string): Promise<number> {
  const trimmed = board.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const boards = await listBoards(client);
  return resolveByName(boards, trimmed, "Board").id;
}

export interface BoardStructure {
  boardName?: string;
  columns: NamedRef[];
  lanes: NamedRef[];
}

export async function loadStructure(client: KanbanizeClient, boardId: number): Promise<BoardStructure> {
  const data = oneOf(await client.get(`/boards/${boardId}/currentStructure`)) ?? {};
  return {
    boardName: str(data.name),
    columns: parseStructureSide(data.columns, ["column_id"]),
    lanes: parseStructureSide(data.lanes, ["lane_id"]),
  };
}

export async function loadFields(client: KanbanizeClient, boardId: number): Promise<FieldDef[]> {
  const [boardPayload, globalPayload] = await Promise.all([
    client.get(`/boards/${boardId}/customFields`),
    client.get("/customFields"),
  ]);
  const onBoard = idsFrom(boardPayload, ["field_id"]);
  return parseFieldDefs(listOf(globalPayload)).filter((field) => onBoard.has(field.id));
}

export async function loadTypes(client: KanbanizeClient, boardId: number): Promise<NamedRef[]> {
  const boardPayload = await client.get(`/boards/${boardId}/cardTypes`);
  const namedOnBoard = parseTypes(listOf(boardPayload));
  if (namedOnBoard.length > 0) return namedOnBoard;
  const onBoard = idsFrom(boardPayload, ["type_id", "id"]);
  const globals = parseTypes(listOf(await client.get("/cardTypes")));
  if (onBoard.size === 0) return globals;
  return globals.filter((item) => onBoard.has(item.id));
}

export async function loadDropdownRows(client: KanbanizeClient, boardId: number, fieldId: number) {
  const [boardPayload, globalPayload] = await Promise.all([
    client.get(`/boards/${boardId}/customFields/${fieldId}/allowedValues`),
    client.get(`/customFields/${fieldId}/allowedValues`),
  ]);
  return {
    board: parseAllowed(listOf(boardPayload)),
    global: parseAllowed(listOf(globalPayload)),
  };
}

export async function getMe(client: KanbanizeClient): Promise<Record<string, unknown>> {
  const me = oneOf(await client.get("/me"));
  if (!me || !num(me.user_id)) throw new DomainError("Não foi possível ler o usuário da chave.");
  return me;
}

export function formatUser(me: Record<string, unknown> | undefined): string {
  if (!me) return "usuário da chave";
  const id = num(me.user_id);
  const email = str(me.email);
  const name = str(me.realname) ?? str(me.username) ?? str(me.name) ?? email ?? "usuário da chave";
  const idPart = id ? `${id} — ` : "";
  const emailPart = email && email !== name ? ` (${email})` : "";
  return `${idPart}${name}${emailPart}`;
}

export async function getCard(client: KanbanizeClient, cardId: number): Promise<Record<string, unknown>> {
  const card = oneOf(await client.get(`/cards/${cardId}`));
  if (!card || !num(card.card_id)) throw new DomainError(`Card ${cardId} não encontrado.`);
  return card;
}

export async function listCards(
  client: KanbanizeClient,
  query: Query,
): Promise<Record<string, unknown>[]> {
  const payload = await client.get("/cards", { ...query, per_page: 100 });
  return listOf(payload).flatMap((row) => {
    const record = asRecord(row);
    return record ? [record] : [];
  });
}

function idsFrom(payload: unknown, keys: string[]): Set<number> {
  const ids = new Set<number>();
  for (const row of listOf(payload)) {
    const record = asRecord(row);
    if (!record) continue;
    for (const key of keys) {
      const id = num(record[key]);
      if (id) ids.add(id);
    }
  }
  return ids;
}

function parseTypes(rows: unknown[]): NamedRef[] {
  const out: NamedRef[] = [];
  for (const row of rows) {
    const record = asRecord(row);
    if (!record) continue;
    const id = num(record.type_id) ?? num(record.id);
    const name = str(record.name);
    if (!id || !name) continue;
    out.push({ id, name });
  }
  return out;
}
