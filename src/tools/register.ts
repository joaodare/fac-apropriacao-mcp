import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { KanbanizeClient } from "../kanbanize/client.js";
import { DomainError } from "../kanbanize/errors.js";
import { atualizarCard, criarCard } from "./cards.js";
import { alterarHoras, excluirHoras, lancarHoras } from "./horas.js";
import { buscarCards, listarCampos, listarHoras, obterCard, whoami } from "./leitura.js";

const campoSchema = z.object({
  nome: z.string().min(1).describe("Nome do campo customizado"),
  valor: z.string().describe("Texto da opção ou valor do campo"),
});

function text(value: string) {
  return { content: [{ type: "text" as const, text: value }] };
}

function fail(error: unknown) {
  const message = error instanceof DomainError && error.message ? error.message : "Erro inesperado.";
  return { isError: true as const, content: [{ type: "text" as const, text: message }] };
}

async function run(work: () => Promise<string>) {
  try {
    return text(await work());
  } catch (error) {
    return fail(error);
  }
}

export function registerTools(server: McpServer, client: KanbanizeClient): void {
  server.registerTool(
    "whoami",
    { description: "Mostra o usuário dono da chave da API." },
    async () => run(() => whoami(client)),
  );

  server.registerTool(
    "buscar_cards",
    {
      description: "Busca cards no board IA FacPlan, ou um card pelo id. Página de no máximo 100.",
      inputSchema: z.object({
        card_id: z.number().int().positive().optional().describe("Id do card"),
        titulo: z.string().optional().describe("Trecho do título, filtrado nesta página"),
        ocorrencia: z.string().optional().describe("Valor do campo de ocorrência, filtrado nesta página"),
        wbs: z.string().optional().describe("Valor do campo WBS, filtrado nesta página"),
        pagina: z.number().int().positive().optional().describe("Página, a partir de 1"),
      }),
    },
    async (args) =>
      run(() =>
        buscarCards(client, {
          cardId: args.card_id,
          titulo: args.titulo,
          ocorrencia: args.ocorrencia,
          wbs: args.wbs,
          pagina: args.pagina,
        }),
      ),
  );

  server.registerTool(
    "obter_card",
    {
      description: "Lê um card pelo id.",
      inputSchema: z.object({
        card_id: z.number().int().positive().describe("Id do card"),
      }),
    },
    async (args) => run(() => obterCard(client, args.card_id)),
  );

  server.registerTool(
    "listar_campos",
    {
      description: "Lista campos customizados do board IA FacPlan.",
    },
    async () => run(() => listarCampos(client)),
  );

  server.registerTool(
    "listar_horas",
    {
      description: "Lista lançamentos de horas do usuário da chave. Página de no máximo 100.",
      inputSchema: z.object({
        card_id: z.number().int().positive().optional(),
        de: z.string().optional().describe("Data inicial YYYY-MM-DD"),
        ate: z.string().optional().describe("Data final YYYY-MM-DD"),
        pagina: z.number().int().positive().optional(),
      }),
    },
    async (args) =>
      run(() => listarHoras(client, { cardId: args.card_id, de: args.de, ate: args.ate, pagina: args.pagina })),
  );

  server.registerTool(
    "lancar_horas",
    {
      description: "Lança horas no usuário da chave. A tool fala horas; a API recebe segundos. Não aceita outro usuário.",
      inputSchema: z.object({
        card_id: z.number().int().positive(),
        horas: z.number().positive().describe("Horas, mínimo 0,01"),
        data: z.string().describe("YYYY-MM-DD. Data futura é recusada no fuso America/Sao_Paulo"),
        comentario: z.string().optional().describe("Comentário do lançamento"),
      }),
    },
    async (args) =>
      run(() =>
        lancarHoras(client, {
          cardId: args.card_id,
          horas: args.horas,
          data: args.data,
          comentario: args.comentario,
        }),
      ),
  );

  server.registerTool(
    "alterar_horas",
    {
      description: "Altera um lançamento de horas. Não troca o usuário.",
      inputSchema: z.object({
        lancamento_id: z.number().int().positive(),
        horas: z.number().positive().optional(),
        data: z.string().optional().describe("YYYY-MM-DD"),
        comentario: z.string().optional(),
      }),
    },
    async (args) =>
      run(() =>
        alterarHoras(client, {
          lancamentoId: args.lancamento_id,
          horas: args.horas,
          data: args.data,
          comentario: args.comentario,
        }),
      ),
  );

  server.registerTool(
    "excluir_horas",
    {
      description: "Exclui um lançamento de horas pelo id.",
      inputSchema: z.object({
        lancamento_id: z.number().int().positive(),
      }),
    },
    async (args) => run(() => excluirHoras(client, args.lancamento_id)),
  );

  server.registerTool(
    "criar_card",
    {
      description: "Cria um card no board IA FacPlan, na coluna e raia informadas.",
      inputSchema: z.object({
        titulo: z.string().min(1),
        coluna: z.string().min(1).describe("Nome da coluna"),
        raia: z.string().min(1).describe("Nome da raia"),
        tipo: z.string().optional().describe("Nome do tipo do card"),
        prioridade: z.string().optional().describe("Crítica, Alta, Média, Baixa ou 1 a 4"),
        descricao: z.string().optional(),
        campos: z.array(campoSchema).optional(),
      }),
    },
    async (args) =>
      run(() =>
        criarCard(client, {
          titulo: args.titulo,
          coluna: args.coluna,
          raia: args.raia,
          tipo: args.tipo,
          prioridade: args.prioridade,
          descricao: args.descricao,
          campos: args.campos,
        }),
      ),
  );

  server.registerTool(
    "atualizar_card",
    {
      description: "Atualiza título, descrição, tipo, prioridade ou campos. Não move o card e não reenvia a descrição se ela não mudou.",
      inputSchema: z.object({
        card_id: z.number().int().positive(),
        titulo: z.string().min(1).optional(),
        descricao: z.string().optional(),
        tipo: z.string().optional(),
        prioridade: z.string().optional(),
        campos: z.array(campoSchema).optional(),
      }),
    },
    async (args) =>
      run(() =>
        atualizarCard(client, {
          cardId: args.card_id,
          titulo: args.titulo,
          descricao: args.descricao,
          tipo: args.tipo,
          prioridade: args.prioridade,
          campos: args.campos,
        }),
      ),
  );
}
