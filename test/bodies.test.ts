import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildCreateCard,
  buildLoggedTimeCreate,
  buildLoggedTimePatch,
  buildUpdateCard,
  parsePriority,
  priorityLabel,
} from "../src/kanbanize/bodies.js";
import { hoursToSeconds } from "../src/kanbanize/time.js";

interface SchemaCut {
  required: string[];
  properties: Record<string, { type?: string; description?: string }>;
}

const fixture = JSON.parse(readFileSync(new URL("./fixtures/openapi-recorte.json", import.meta.url), "utf8")) as Record<
  string,
  SchemaCut
>;

function schema(name: string): SchemaCut {
  const cut = fixture[name];
  if (!cut) throw new Error(`recorte sem ${name}`);
  return cut;
}

function expectFits(body: Record<string, unknown>, cut: SchemaCut) {
  for (const key of Object.keys(body)) expect(cut.properties, key).toHaveProperty(key);
  for (const key of cut.required) expect(body, key).toHaveProperty(key);
}

describe("body conforme o OpenAPI da conta", () => {
  it("lança segundos no campo time e comentário, sem usuário e sem description", () => {
    const cut = schema("POST /loggedTime");
    const body = buildLoggedTimeCreate({
      cardId: 10,
      seconds: hoursToSeconds(1),
      date: "2026-11-03",
      comment: "nota",
    });
    expect(body).toEqual({ card_id: 10, time: 3600, date: "2026-11-03", comment: "nota" });
    expectFits(body, cut);
    expect(cut.properties.time?.type).toBe("integer");
    expect(cut.properties.time?.description).toMatch(/seconds/);
    expect(cut.properties).not.toHaveProperty("description");
    expect(body).not.toHaveProperty("user_id");
  });

  it("altera só o que foi pedido", () => {
    const cut = schema("PATCH /loggedTime/{logged_time_id}");
    expect(buildLoggedTimePatch({ comment: "novo" })).toEqual({ comment: "novo" });
    const body = buildLoggedTimePatch({ seconds: hoursToSeconds(0.5) });
    expect(body).toEqual({ time: 1800 });
    expectFits(body, cut);
    expect(cut.properties).not.toHaveProperty("description");
  });

  it("cria card com description e dropdown em value_id", () => {
    const cut = schema("POST /cards");
    const body = buildCreateCard({
      columnId: 3,
      laneId: 4,
      title: "Card",
      description: "texto",
      priority: 2,
      fields: [
        { fieldId: 8, name: "Status", type: "dropdown", valor: "Sim", valueId: 9 },
        { fieldId: 5, name: "WBS", type: "single_line_text", valor: "1.2" },
      ],
    });
    expectFits(body, cut);
    expect(body.description).toBe("texto");
    expect(body).not.toHaveProperty("comment");
    expect(body).not.toHaveProperty("board_id");
    expect(body.custom_fields_to_add_or_update).toEqual([
      { field_id: 8, selected_values_to_add_or_update: [{ value_id: 9 }] },
      { field_id: 5, value: "1.2" },
    ]);
    const field = schema("CardCustomFieldWithIdAddOrUpdateRequest");
    expect(field.properties).toHaveProperty("selected_values_to_add_or_update");
    expect(field.properties.value?.type).toBe("string");
  });

  it("não reenvia a descrição nem move o card quando só muda um campo", () => {
    const body = buildUpdateCard({
      fields: [{ fieldId: 5, name: "WBS", type: "single_line_text", valor: "9" }],
    });
    expect(body).toEqual({
      custom_fields_to_add_or_update: [{ field_id: 5, value: "9" }],
    });
    expectFits(body, schema("PATCH /cards/{card_id}"));
  });
});

describe("prioridade", () => {
  it("segue a escala do OpenAPI: 1 Crítica a 4 Baixa", () => {
    const description = schema("POST /cards").properties.priority?.description ?? "";
    expect(description).toMatch(/`1` corresponds to `Critical`/);
    expect(description).toMatch(/`4` corresponds to `Low`/);
    expect(parsePriority("Crítica")).toBe(1);
    expect(parsePriority("baixa")).toBe(4);
    expect(priorityLabel(1)).toBe("Crítica");
    expect(priorityLabel(4)).toBe("Baixa");
  });

  it("recusa chaves do protótipo", () => {
    for (const value of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
      expect(() => parsePriority(value), value).toThrow(/Prioridade inválida/);
    }
  });
});
