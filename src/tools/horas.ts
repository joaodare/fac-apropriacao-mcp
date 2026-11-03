import { buildLoggedTimeCreate, buildLoggedTimePatch } from "../kanbanize/bodies.js";
import { formatUser, getMe } from "../kanbanize/catalog.js";
import { KanbanizeClient } from "../kanbanize/client.js";
import { num, oneOf, str } from "../kanbanize/json.js";
import { assertWorkDate, hoursToSeconds, secondsToHours } from "../kanbanize/time.js";

export async function lancarHoras(
  client: KanbanizeClient,
  args: { cardId: number; horas: number; data: string; comentario?: string },
): Promise<string> {
  const seconds = hoursToSeconds(args.horas);
  const date = assertWorkDate(args.data);
  const me = await getMe(client);
  const body = buildLoggedTimeCreate({
    cardId: args.cardId,
    seconds,
    date,
    comment: args.comentario,
  });
  const created = oneOf(await client.post("/loggedTime", body)) ?? {};
  const id = num(created.logged_time_id) ?? num(created.id) ?? "?";
  const echoed = num(created.time);
  const hours = echoed === undefined ? secondsToHours(seconds) : secondsToHours(echoed);
  return [
    `Lançamento ${id}`,
    `Card ${num(created.card_id) ?? args.cardId}`,
    `Horas: ${hours}`,
    `Data: ${str(created.date) ?? date}`,
    `Usuário: ${formatUser(me)}`,
  ].join("\n");
}

export async function alterarHoras(
  client: KanbanizeClient,
  args: { lancamentoId: number; horas?: number; data?: string; comentario?: string },
): Promise<string> {
  const seconds = args.horas === undefined ? undefined : hoursToSeconds(args.horas);
  const date = args.data === undefined ? undefined : assertWorkDate(args.data);
  const body = buildLoggedTimePatch({ seconds, date, comment: args.comentario });
  await client.patch(`/loggedTime/${args.lancamentoId}`, body);
  const lines = [`Lançamento ${args.lancamentoId} alterado.`];
  if (seconds !== undefined) lines.push(`Horas: ${secondsToHours(seconds)}`);
  if (date) lines.push(`Data: ${date}`);
  if (args.comentario !== undefined) lines.push("Comentário atualizado.");
  return lines.join("\n");
}

export async function excluirHoras(client: KanbanizeClient, lancamentoId: number): Promise<string> {
  await client.delete(`/loggedTime/${lancamentoId}`);
  return `Lançamento ${lancamentoId} excluído.`;
}
