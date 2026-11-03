import { describe, expect, it } from "vitest";
import { KanbanizeClient, type HttpFetch, type HttpResponse } from "../src/kanbanize/client.js";
import { lancarHoras } from "../src/tools/horas.js";
import { atualizarCard } from "../src/tools/cards.js";

const KEY = "test-key-not-real";

function json(status: number, body: unknown): HttpResponse {
  return { status, text: async () => JSON.stringify(body) };
}

function client(fetchImpl: HttpFetch, sleep?: (ms: number) => Promise<void>): KanbanizeClient {
  return new KanbanizeClient({
    config: { apiKey: KEY, subdomain: "grupofacil" },
    fetchImpl,
    sleep,
  });
}

describe("cliente HTTP", () => {
  it("repete só o RL02 e não repete falha de rede nem HTTP 500", async () => {
    const sleeps: number[] = [];
    let rateCalls = 0;
    const limited = client(async () => {
      rateCalls += 1;
      if (rateCalls === 1) {
        return json(429, { error: { code: "RL02", message: KEY, reference: "r", details: { retry_after: "1" } } });
      }
      return json(200, { data: { user_id: 1 } });
    }, async (ms) => {
      sleeps.push(ms);
    });
    await expect(limited.get("/me")).resolves.toEqual({ data: { user_id: 1 } });
    expect(rateCalls).toBe(2);
    expect(sleeps).toEqual([1000]);

    let serverCalls = 0;
    const server = client(async () => {
      serverCalls += 1;
      return json(500, `<html>${KEY}</html>`);
    });
    await expect(server.post("/cards", { title: "x" })).rejects.toThrow("Erro HTTP 500.");
    expect(serverCalls).toBe(1);

    let networkCalls = 0;
    const network = client(async () => {
      networkCalls += 1;
      throw new Error(`socket ${KEY}`);
    });
    await expect(network.get("/me")).rejects.toThrow(/não foi repetida/);
    expect(networkCalls).toBe(1);
  });

  it("manda a chave no header e não na URL", async () => {
    let seen = "";
    let header = "";
    const api = client(async (url, init) => {
      seen = url;
      header = init.headers.apikey ?? "";
      return json(200, { data: { user_id: 1 } });
    });
    await api.get("/me");
    expect(header).toBe(KEY);
    expect(seen).toBe("https://grupofacil.kanbanize.com/api/v2/me");
    expect(seen).not.toContain(KEY);
  });
});

describe("lançamento e atualização sem rede", () => {
  it("grava o lançamento em segundos no usuário da chave", async () => {
    const bodies: unknown[] = [];
    const api = client(async (url, init) => {
      if (url.endsWith("/me")) return json(200, { data: { user_id: 7, realname: "Ana", email: "ana@example.com" } });
      bodies.push(JSON.parse(init.body ?? "{}"));
      return json(200, { data: { logged_time_id: 9, card_id: 10, time: 3600, date: "2026-11-02" } });
    });
    const text = await lancarHoras(api, { cardId: 10, horas: 1, data: "2026-11-02", comentario: "nota" });
    expect(bodies).toEqual([{ card_id: 10, time: 3600, date: "2026-11-02", comment: "nota" }]);
    expect(text).toContain("Horas: 1");
    expect(text).toContain("Usuário: 7 — Ana");
    expect(text).not.toContain(KEY);
  });

  it("atualiza um campo sem reenviar a descrição", async () => {
    const bodies: { method: string; body?: unknown }[] = [];
    const api = client(async (url, init) => {
      bodies.push({ method: init.method, body: init.body ? JSON.parse(init.body) : undefined });
      if (url.endsWith("/cards/10")) {
        if (init.method === "GET") return json(200, { data: { card_id: 10, board_id: 3, title: "Antigo" } });
        return json(200, { data: { card_id: 10 } });
      }
      if (url.endsWith("/boards/3/customFields")) return json(200, { data: [{ field_id: 5 }] });
      if (url.endsWith("/customFields")) {
        return json(200, { data: [{ field_id: 5, name: "WBS", type: "single_line_text" }] });
      }
      return json(404, {});
    });
    const text = await atualizarCard(api, { cardId: 10, campos: [{ nome: "wbs", valor: "1.2" }] });
    const patch = bodies.find((call) => call.method === "PATCH");
    expect(patch?.body).toEqual({ custom_fields_to_add_or_update: [{ field_id: 5, value: "1.2" }] });
    expect(text).toContain("WBS=1.2");
    expect(text).not.toContain("Descrição atualizada");
  });
});
