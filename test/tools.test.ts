import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it } from "vitest";
import { KanbanizeClient, type HttpFetch, type HttpResponse } from "../src/kanbanize/client.js";
import { alterarHoras, excluirHoras } from "../src/tools/horas.js";
import { buscarCards, listarHoras } from "../src/tools/leitura.js";
import { registerTools } from "../src/tools/register.js";

const KEY = "test-key-not-real";

function json(status: number, body: unknown): HttpResponse {
  return { status, text: async () => JSON.stringify(body) };
}

interface Call {
  method: string;
  url: URL;
}

function client(route: (call: Call) => HttpResponse): { api: KanbanizeClient; calls: Call[] } {
  const calls: Call[] = [];
  const fetchImpl: HttpFetch = async (url, init) => {
    const call = { method: init.method, url: new URL(url) };
    calls.push(call);
    return route(call);
  };
  return { api: new KanbanizeClient({ config: { apiKey: KEY, subdomain: "grupofacil" }, fetchImpl }), calls };
}

const structure = { data: { name: "Squad", columns: { "1": { name: "Doing", workflow_id: 1 } }, lanes: {} } };

function boardRoutes(call: Call, cards: unknown[], fields: unknown[] = []): HttpResponse {
  const path = call.url.pathname.replace("/api/v2", "");
  if (path === "/cards") return json(200, { data: { data: cards } });
  if (path === "/boards/3/customFields") return json(200, { data: fields.map((f) => ({ field_id: (f as { field_id: number }).field_id })) });
  if (path === "/customFields") return json(200, { data: fields });
  if (path === "/boards/3/currentStructure") return json(200, structure);
  return json(404, {});
}

describe("buscar_cards", () => {
  it("avisa truncamento mesmo quando a página cheia não tem nenhum card do filtro", async () => {
    const cards = Array.from({ length: 100 }, (_, i) => ({ card_id: i + 1, title: `Outro ${i}`, board_id: 3 }));
    const { api } = client((call) => boardRoutes(call, cards));
    const text = await buscarCards(api, { board: "3", titulo: "alvo" });
    expect(text).toMatch(/^Nenhum card encontrado\./);
    expect(text).toMatch(/Aviso: .*truncada; tente pagina 2/);
  });

  it("diz que o board não tem o campo em vez de responder vazio", async () => {
    const { api } = client((call) =>
      boardRoutes(call, [{ card_id: 1, title: "x", board_id: 3 }], [{ field_id: 5, name: "Cliente", type: "single_line_text" }]),
    );
    await expect(buscarCards(api, { board: "3", wbs: "1.2" })).rejects.toThrow(/não tem campo de WBS/);
    await expect(buscarCards(api, { board: "3", ocorrencia: "99" })).rejects.toThrow(/não tem campo de ocorrência/);
  });
});

describe("listar_horas", () => {
  const me = json(200, { data: { user_id: 7 } });

  it("aceita data final futura no filtro", async () => {
    const { api, calls } = client((call) => (call.url.pathname.endsWith("/me") ? me : json(200, { data: [] })));
    await expect(listarHoras(api, { de: "2026-11-01", ate: "2999-12-31" })).resolves.toBe("Nenhum lançamento encontrado.");
    const list = calls.find((call) => call.url.pathname.endsWith("/loggedTime"));
    expect(list?.url.searchParams.get("to_date")).toBe("2999-12-31");
    expect(list?.url.searchParams.get("user_ids")).toBe("7");
  });

  it("recusa intervalo invertido e data malformada", async () => {
    const { api } = client(() => me);
    await expect(listarHoras(api, { de: "2026-11-10", ate: "2026-11-01" })).rejects.toThrow(/inicial é maior/);
    await expect(listarHoras(api, { ate: "2026-02-30" })).rejects.toThrow(/Data inválida/);
  });
});

describe("alterar e excluir horas", () => {
  function entryRoutes(owner: number) {
    return (call: Call): HttpResponse => {
      if (call.url.pathname.endsWith("/me")) return json(200, { data: { user_id: 7 } });
      if (call.method === "GET") return json(200, { data: { logged_time_id: 50, user_id: owner, time: 3600 } });
      return json(200, { data: { logged_time_id: 50 } });
    };
  }

  it("recusa lançamento de outro usuário sem mandar PATCH nem DELETE", async () => {
    const { api, calls } = client(entryRoutes(8));
    await expect(alterarHoras(api, { lancamentoId: 50, horas: 2 })).rejects.toThrow(/outro usuário/);
    await expect(excluirHoras(api, 50)).rejects.toThrow(/outro usuário/);
    expect(calls.filter((call) => call.method !== "GET")).toEqual([]);
  });

  it("altera e exclui o próprio lançamento", async () => {
    const { api, calls } = client(entryRoutes(7));
    await expect(alterarHoras(api, { lancamentoId: 50, horas: 2 })).resolves.toContain("Horas: 2");
    await expect(excluirHoras(api, 50)).resolves.toContain("excluído");
    expect(calls.filter((call) => call.method !== "GET").map((call) => call.method)).toEqual(["PATCH", "DELETE"]);
  });
});

describe("registro das tools", () => {
  it("não devolve mensagem crua de erro que não é de domínio", async () => {
    const handlers = new Map<string, (args: unknown) => Promise<{ isError?: boolean; content: { text: string }[] }>>();
    const server = {
      registerTool: (name: string, _config: unknown, handler: (args: unknown) => Promise<never>) => {
        handlers.set(name, handler);
      },
    } as unknown as McpServer;
    const broken = {
      get: async () => {
        throw new Error(`stack interna ${KEY}`);
      },
    } as unknown as KanbanizeClient;
    registerTools(server, broken);
    const result = await handlers.get("whoami")?.({});
    expect(result?.isError).toBe(true);
    expect(result?.content[0]?.text).toBe("Erro inesperado.");
  });
});
