import {
  formatUser,
  getCard,
  getMe,
  listCards,
  loadFields,
  loadStructure,
  assertCardOnFixedBoard,
  fixedBoard,
} from "../kanbanize/catalog.js";
import { KanbanizeClient } from "../kanbanize/client.js";
import { DomainError } from "../kanbanize/errors.js";
import { asRecord, listOf, num, str } from "../kanbanize/json.js";
import { assertDateFormat, secondsToHours } from "../kanbanize/time.js";
import { cardFieldLines, fieldValueHas, formatCard, loggedHours } from "./format.js";

export async function whoami(client: KanbanizeClient): Promise<string> {
  const me = await getMe(client);
  return `Usuário ${formatUser(me, true)}`;
}

export async function buscarCards(
  client: KanbanizeClient,
  args: {
    cardId?: number;
    titulo?: string;
    ocorrencia?: string;
    wbs?: string;
    meus?: boolean;
    pagina?: number;
  },
): Promise<string> {
  const page = args.pagina ?? 1;
  if (page < 1) throw new DomainError("Página inválida.");
  const textLocal = Boolean(args.titulo || args.ocorrencia || args.wbs);
  const mine = args.meus === true;
  const local = textLocal || mine;
  const userId = mine ? await currentUserId(client) : undefined;
  const board = await fixedBoard(client);
  const boardId = board.id;
  let cards: Record<string, unknown>[];
  if (args.cardId !== undefined && !local) {
    cards = [await getCard(client, args.cardId)];
    await assertCardOnFixedBoard(client, args.cardId, num(cards[0]?.board_id));
  } else {
    const parts: string[] = [];
    if (textLocal) parts.push("custom_fields");
    if (mine) parts.push("co_owner_ids");
    const expand = parts.join(",");
    cards = await listCards(client, {
      board_ids: boardId,
      card_ids: args.cardId,
      page,
      fields: "card_id,title,board_id,workflow_id,column_id,lane_id,owner_user_id,priority,current_logged_time",
      expand: expand || undefined,
    });
  }
  const fields = textLocal && boardId ? await loadFields(client, boardId) : [];
  if (args.ocorrencia) assertFieldExists(fields, OCORRENCIA, "ocorrência");
  if (args.wbs) assertFieldExists(fields, WBS, "WBS");
  const filtered = local ? cards.filter((card) => matches(card, args, fields, userId)) : cards;
  const warn =
    local && cards.length === 100
      ? `\n\nAviso: o filtro de título, ocorrência, WBS ou meus vale só para esta página de 100. A lista pode estar truncada; tente pagina ${page + 1}.`
      : "";
  if (filtered.length === 0) return "Nenhum card encontrado." + warn;
  const labels = boardId ? await labelsFor(client, boardId) : undefined;
  const blocks = filtered.map((card) =>
    formatCard(card, {
      board: labels?.board,
      column: nameOf(labels?.columns, num(card.column_id)),
      lane: nameOf(labels?.lanes, num(card.lane_id)),
      fields: cardFieldLines(card, fields),
      hours: loggedHours(card),
    }),
  );
  return blocks.join("\n\n") + warn;
}

export async function obterCard(client: KanbanizeClient, cardId: number): Promise<string> {
  const card = await getCard(client, cardId);
  const boardId = (await assertCardOnFixedBoard(client, cardId, num(card.board_id))).id;
  const fields = boardId ? await loadFields(client, boardId) : [];
  const labels = boardId ? await labelsFor(client, boardId) : undefined;
  return formatCard(card, {
    board: labels?.board,
    column: nameOf(labels?.columns, num(card.column_id)),
    lane: nameOf(labels?.lanes, num(card.lane_id)),
    fields: cardFieldLines(card, fields),
    hours: loggedHours(card),
  });
}

export async function listarCampos(client: KanbanizeClient): Promise<string> {
  const boardId = (await fixedBoard(client)).id;
  const fields = await loadFields(client, boardId);
  if (fields.length === 0) return "Nenhum campo encontrado.";
  return fields.map((field) => `${field.id} — ${field.name} (${field.type || "texto"})`).join("\n");
}

export async function listarHoras(
  client: KanbanizeClient,
  args: { cardId?: number; de?: string; ate?: string; pagina?: number },
): Promise<string> {
  if (args.cardId === undefined && !args.de && !args.ate) {
    throw new DomainError("Informe o card ou um intervalo de datas.");
  }
  const from = args.de ? assertDateFormat(args.de) : undefined;
  const to = args.ate ? assertDateFormat(args.ate) : undefined;
  if (from && to && from > to) throw new DomainError("A data inicial é maior que a final.");
  const me = await getMe(client);
  const userId = num(me.user_id);
  const page = args.pagina ?? 1;
  if (page < 1) throw new DomainError("Página inválida.");
  const payload = await client.get("/loggedTime", {
    user_ids: userId,
    card_ids: args.cardId,
    from_date: from,
    to_date: to,
    page,
    per_page: 100,
  });
  const rows = listOf(payload).flatMap((row) => {
    const record = asRecord(row);
    return record ? [record] : [];
  });
  if (rows.length === 0) return "Nenhum lançamento encontrado.";
  const lines = rows.map((row) => {
    const id = num(row.logged_time_id) ?? num(row.id) ?? "?";
    const cardId = num(row.card_id) ?? "?";
    const seconds = num(row.time);
    const hours = seconds === undefined ? "?" : secondsToHours(seconds);
    const date = str(row.date) ?? "";
    const comment = str(row.comment);
    return `Lançamento ${id} — card ${cardId} — ${hours} h — ${date}${comment ? ` — ${comment}` : ""}`;
  });
  const warn = rows.length === 100 ? "\nAviso: página limitada a 100 lançamentos." : "";
  return lines.join("\n") + warn;
}

function matches(
  card: Record<string, unknown>,
  args: { titulo?: string; ocorrencia?: string; wbs?: string; meus?: boolean },
  fields: { id: number; name: string; type: string }[],
  userId?: number,
): boolean {
  if (args.titulo) {
    const title = str(card.title) ?? "";
    if (!title.toLowerCase().includes(args.titulo.trim().toLowerCase())) return false;
  }
  if (args.ocorrencia && !fieldValueHas(card, fields, OCORRENCIA, args.ocorrencia)) return false;
  if (args.wbs && !fieldValueHas(card, fields, WBS, args.wbs)) return false;
  if (args.meus === true && (userId === undefined || !isMine(card, userId))) return false;
  return true;
}

async function currentUserId(client: KanbanizeClient): Promise<number> {
  const userId = num((await getMe(client)).user_id);
  if (userId === undefined) throw new DomainError("Não foi possível ler o usuário da chave.");
  return userId;
}

function isMine(card: Record<string, unknown>, userId: number): boolean {
  if (num(card.owner_user_id) === userId) return true;
  return coOwnerIds(card.co_owner_ids).includes(userId);
}

function coOwnerIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const id = num(item);
    return id === undefined ? [] : [id];
  });
}

const OCORRENCIA = /ocorr/i;
const WBS = /wbs/i;

function assertFieldExists(fields: { name: string }[], pattern: RegExp, label: string): void {
  if (!fields.some((field) => pattern.test(field.name))) {
    throw new DomainError(`O board não tem campo de ${label}.`);
  }
}

async function labelsFor(client: KanbanizeClient, boardId: number) {
  const structure = await loadStructure(client, boardId);
  return {
    board: structure.boardName ?? String(boardId),
    columns: new Map(structure.columns.map((column) => [column.id, column.name])),
    lanes: new Map(structure.lanes.map((lane) => [lane.id, lane.name])),
  };
}

function nameOf(map: Map<number, string> | undefined, id: number | undefined): string | undefined {
  if (!map || id === undefined) return undefined;
  return map.get(id);
}
