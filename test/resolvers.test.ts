import { describe, expect, it } from "vitest";
import {
  joinDropdownOptions,
  parseStructureSide,
  resolveByName,
  resolveOptionId,
  resolvePlacement,
} from "../src/kanbanize/resolvers.js";

const columns = parseStructureSide(
  {
    "10": { name: "Doing", workflow_id: 1 },
    "11": { name: "Doing", workflow_id: 2 },
    "12": { name: "Filho", workflow_id: 1 },
    "13": { name: "Pai.Filho", workflow_id: 1 },
    "14": { name: "Doing extra", workflow_id: 1 },
  },
  ["column_id"],
);

const lanes = parseStructureSide(
  {
    "20": { name: "Expedite", workflow_id: 1 },
    "21": { name: "Padrão", workflow_id: 2 },
  },
  ["lane_id"],
);

describe("resolução por nome", () => {
  it("ignora maiúsculas e usa o último segmento depois do ponto", () => {
    expect(resolveByName(columns, "filho", "Coluna", 1).id).toBe(12);
    expect(resolveByName(columns, "Backlog.Filho", "Coluna", 1).id).toBe(12);
  });

  it("prefere o nome inteiro quando ele existe", () => {
    expect(resolveByName(columns, "Pai.Filho", "Coluna", 1).id).toBe(13);
  });

  it("não casa por substring", () => {
    expect(() => resolveByName(columns, "Doing ext", "Coluna", 1)).toThrow(/não encontrado/);
  });

  it("respeita o workflow e erra se o nome continua ambíguo", () => {
    expect(resolveByName(columns, "Doing", "Coluna", 2).id).toBe(11);
    expect(() => resolveByName(columns, "Doing", "Coluna")).toThrow(/#10/);
    expect(() => resolveByName(columns, "Doing", "Coluna")).toThrow(/#11/);
  });

  it("amarra coluna e raia pelo workflow da raia", () => {
    expect(resolvePlacement(columns, lanes, "Doing", "Padrão")).toEqual({ columnId: 11, laneId: 21 });
    expect(resolvePlacement(columns, lanes, "Backlog.Filho", "Expedite")).toEqual({ columnId: 12, laneId: 20 });
  });
});

describe("dropdown", () => {
  it("usa o global quando o board não tem opções", () => {
    const options = joinDropdownOptions([], [
      { valueId: 9, text: "Sim", enabled: true },
      { valueId: 8, text: "Não", enabled: false },
    ]);
    expect(resolveOptionId(options, "sim")).toBe(9);
    expect(() => resolveOptionId(options, "Não")).toThrow(/não encontrada/);
  });

  it("restringe às opções habilitadas do board e pega o texto no global", () => {
    const options = joinDropdownOptions(
      [
        { valueId: 9, enabled: true },
        { valueId: 8, enabled: false },
      ],
      [
        { valueId: 9, text: "Sim", enabled: true },
        { valueId: 8, text: "Não", enabled: true },
      ],
    );
    expect(options.map((item) => item.valueId)).toEqual([9]);
    expect(resolveOptionId(options, "Sim")).toBe(9);
  });
});
