import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildCreateCard, buildLoggedTimeCreate, buildLoggedTimePatch, buildUpdateCard } from "../src/kanbanize/bodies.js";
import { hoursToSeconds } from "../src/kanbanize/time.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/openapi-recorte.json", import.meta.url), "utf8"));

describe("body conforme o OpenAPI da conta", () => {
  it("lança segundos no campo time e comentário, sem usuário e sem description", () => {
    const body = buildLoggedTimeCreate({
      cardId: 10,
      seconds: hoursToSeconds(1),
      date: "2026-11-03",
      comment: "nota",
    });
    expect(body).toEqual({ card_id: 10, time: 3600, date: "2026-11-03", comment: "nota" });
    expect(body).not.toHaveProperty("description");
    expect(body).not.toHaveProperty("user_id");
    expect(fixture.loggedTime.post.time).toBe("integer seconds");
    expect(fixture.loggedTime.post.description).toBe(false);
    expect(fixture.loggedTime.post.user_id_enviado).toBe(false);
  });

  it("altera só o que foi pedido", () => {
    expect(buildLoggedTimePatch({ comment: "novo" })).toEqual({ comment: "novo" });
    expect(buildLoggedTimePatch({ seconds: hoursToSeconds(0.5) })).toEqual({ time: 1800 });
    expect(fixture.loggedTime.patch.description).toBe(false);
  });

  it("cria card com description e dropdown em value_id", () => {
    const body = buildCreateCard({
      columnId: 3,
      laneId: 4,
      title: "Card",
      description: "texto",
      fields: [
        { fieldId: 8, name: "Status", type: "dropdown", valor: "Sim", valueId: 9 },
        { fieldId: 5, name: "WBS", type: "single_line_text", valor: "1.2" },
      ],
    });
    expect(body.description).toBe("texto");
    expect(body).not.toHaveProperty("comment");
    expect(body).not.toHaveProperty("board_id");
    expect(body.custom_fields_to_add_or_update).toEqual([
      { field_id: 8, selected_values_to_add_or_update: [{ value_id: 9 }] },
      { field_id: 5, value: "1.2" },
    ]);
    expect(fixture.cards.post.comment).toBe(false);
    expect(fixture.cards.post.board_id).toBe(false);
  });

  it("não reenvia a descrição nem move o card quando só muda um campo", () => {
    const body = buildUpdateCard({
      fields: [{ fieldId: 5, name: "WBS", type: "single_line_text", valor: "9" }],
    });
    expect(body).toEqual({
      custom_fields_to_add_or_update: [{ field_id: 5, value: "9" }],
    });
    expect(body).not.toHaveProperty("description");
    expect(body).not.toHaveProperty("column_id");
    expect(body).not.toHaveProperty("lane_id");
    expect(fixture.cards.patch.description_omitida_permanece).toBe(true);
    expect(fixture.cards.patch.column_id_enviado).toBe(false);
  });
});
