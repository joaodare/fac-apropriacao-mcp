import { describe, expect, it } from "vitest";
import { readRateLimitWait, translateApiError } from "../src/kanbanize/errors.js";

const KEY = "test-key-not-real";

describe("erros da API", () => {
  it("lê o retry do RL02 e limita a espera", () => {
    expect(readRateLimitWait({ error: { code: "RL02", details: { retry_after: "2" } } })).toBe(2);
    expect(readRateLimitWait({ code: "RL02", details: { retry_after: 999 } })).toBe(120);
    expect(readRateLimitWait({ code: "RL02" })).toBe(30);
    expect(readRateLimitWait({ error: { code: "ARU5" } })).toBeNull();
  });

  it("traduz ARU5 e C191 sem corpo cru e sem a chave", () => {
    const raw = JSON.stringify({
      error: { code: "ARU5", message: `regra ${KEY} detalhe enorme`, reference: "abc" },
    });
    const message = translateApiError(400, raw, KEY);
    expect(message).toBe("O card não atende às regras de chegada da coluna de destino.");
    expect(message).not.toContain(KEY);

    const exit = translateApiError(400, JSON.stringify({ code: "C191", message: KEY }), KEY);
    expect(exit).toBe("Falta cumprir os critérios de saída da coluna atual.");
    expect(exit).not.toContain(KEY);
  });

  it("resume outro erro e remove a chave", () => {
    const raw = JSON.stringify({ error: { code: "X001", message: `falha ${KEY} fim`, reference: "r" } });
    const message = translateApiError(422, raw, KEY);
    expect(message).toContain("X001");
    expect(message).toContain("HTTP 422");
    expect(message).not.toContain(KEY);
    expect(translateApiError(500, `<html>${KEY}</html>`, KEY)).toBe("Erro HTTP 500.");
  });
});
