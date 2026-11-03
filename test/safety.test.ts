import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function files(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...files(full));
    else if (name.endsWith(".ts")) out.push(full);
  }
  return out;
}

describe("stdio e segredo", () => {
  it("não escreve no stdout com console.log", () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");
    for (const file of files(root)) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/console\.log/);
    }
  });
});
