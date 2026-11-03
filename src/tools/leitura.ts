import {
  formatUser,
  getCard,
  getMe,
  listBoards,
  listCards,
  loadFields,
  loadStructure,
  resolveBoardId,
} from "../kanbanize/catalog.js";
import { KanbanizeClient } from "../kanbanize/client.js";
import { DomainError } from "../kanbanize/errors.js";
import { asRecord, listOf, num, str } from "../kanbanize/json.js";
import { assertWorkDate, secondsToHours } from "../kanbanize/time.js";
import { cardFieldLines, fieldValueHas, formatCard, loggedHours } from "./format.js";

export async function whoami(client: KanbanizeClient): Promise<string> {
  const me = await getMe(client);
  return `Usuário ${formatUser(me)}`;
}

export async function listarBoards(client: KanbanizeClient, nome?: string): Promise<string> {
  let boards = await listBoards(client);
  if (nome?.trim()) {
    const query = nome.trim().toLowerCase();
    boards = boards.filter((board) => board.name.toLowerCase().includes(query) || String(board.id) === nome.trim());
  }
  if (boards.length === 0) return "Nenhum board encontrado.";
  return boards.map((board) => `${board.id} — ${board.name}`).join("\n");
}

export async function buscarCards(
  client: KanbanizeClient,
  args: {
    board?: string;
    cardId?: number;
    titulo?: string;
    ocorrencia?: string;
    wbs?: string;
    pagina?: number;
  },
): Promise<string> {
  if (!args.board && args.cardId === undefined) {
    throw new DomainError("Informe o board ou o id do card.");
  }
  const page = args.pagina ?? 1;
  if (page < 1) throw new DomainError("Página inválida.");
  const local = Boolean(args.titulo || args.ocorrencia || args.wbs);
  let cards: Record<string, unknown>[];
  let boardId: number | undefined;
  if (args.cardId !== undefined && !args.board) {
    cards = [await getCard(client, args.cardId)];
    boardId = num(cards[0]?.board_id);
  } else {
    boardId = await resolveBoardId(client, args.board ?? "");
    cards = await listCards(client, {
      board_ids: boardId,
      card_ids: args.cardId,
      page,
      fields: "card_id,title,board_id,workflow_id,column_id,lane_id,owner_user_id,priority,current_logged_time",
      expand: local ? "custom_fields" : undefined,
    });
  }
  const fields = local && boardId ? await loadFields(client, boardId) : [];
  const filtered = local
    ? cards.filter((card) => matches(card, args, fields))
    : cards;
  const labels = boardId ? await labelsFor(client, boardId) : undefined;
  if (filtered.length === 0) return "Nenhum card encontrado.";
  const blocks = filtered.map((card) =>
    formatCard(card, {
      board: labels?.board,
      column: nameOf(labels?.columns, num(card.column_id)),
      lane: nameOf(labels?.lanes, num(card.lane_id)),
      fields: cardFieldLines(card, fields),
      hours: loggedHours(card),
    }),
  );
  const warn =
    local && cards.length === 100
      ? "\n\nAviso: o filtro de título, ocorrência ou WBS vale só para esta página de 100. A lista pode estar truncada."
      : "";
  return blocks.join("\n\n") + warn;
}

export async function obterCard(client: KanbanizeClient, cardId: number): Promise<string> {
  const card = await getCard(client, cardId);
  const boardId = num(card.board_id);
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

export async function listarCampos(client: KanbanizeClient, board: string): Promise<string> {
  const boardId = await resolveBoardId(client, board);
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
  const from = args.de ? assertWorkDate(args.de) : undefined;
  const to = args.ate ? assertWorkDate(args.ate) : undefined;
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
  args: { titulo?: string; ocorrencia?: string; wbs?: string },
  fields: { id: number; name: string; type: string }[],
): boolean {
  if (args.titulo) {
    const title = str(card.title) ?? "";
    if (!title.toLowerCase().includes(args.titulo.trim().toLowerCase())) return false;
  }
  if (args.ocorrencia && !fieldValueHas(card, fields, /ocorr/i, args.ocorrencia)) return false;
  if (args.wbs && !fieldValueHas(card, fields, /wbs/i, args.wbs)) return false;
  return true;
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
