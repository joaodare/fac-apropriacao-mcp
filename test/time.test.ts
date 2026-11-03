import { describe, expect, it } from "vitest";
import { assertWorkDate, hoursToSeconds, secondsToHours, todayInSaoPaulo } from "../src/kanbanize/time.js";

describe("horas para segundos", () => {
  it("arredonda horas válidas", () => {
    expect(hoursToSeconds(1)).toBe(3600);
    expect(hoursToSeconds(0.01)).toBe(36);
    expect(hoursToSeconds(1.5)).toBe(5400);
    expect(secondsToHours(3600)).toBe(1);
    expect(secondsToHours(36)).toBe(0.01);
  });

  it("recusa abaixo de 0,01 h antes de aceitar o arredondamento", () => {
    expect(() => hoursToSeconds(0.004)).toThrow(/0,01/);
    expect(() => hoursToSeconds(0.009)).toThrow(/0,01/);
    expect(() => hoursToSeconds(0)).toThrow(/0,01/);
    expect(() => hoursToSeconds(Number.NaN)).toThrow(/0,01/);
  });

  it("recusa acima de 6.000.000 segundos", () => {
    expect(() => hoursToSeconds(1667)).toThrow(/6\.000\.000/);
    expect(hoursToSeconds(6_000_000 / 3600)).toBe(6_000_000);
  });
});

describe("data no fuso de São Paulo", () => {
  const almostTomorrowUtc = new Date("2026-11-03T02:00:00.000Z");

  it("trata 02:00 UTC como o dia anterior em São Paulo", () => {
    expect(todayInSaoPaulo(almostTomorrowUtc)).toBe("2026-11-02");
    expect(assertWorkDate("2026-11-02", almostTomorrowUtc)).toBe("2026-11-02");
    expect(() => assertWorkDate("2026-11-03", almostTomorrowUtc)).toThrow(/futura/);
  });

  it("recusa formato inválido", () => {
    expect(() => assertWorkDate("03/11/2026")).toThrow(/YYYY-MM-DD/);
    expect(() => assertWorkDate("2026-13-01")).toThrow(/YYYY-MM-DD/);
    expect(() => assertWorkDate("2026-02-31")).toThrow(/YYYY-MM-DD/);
  });
});
