import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { KanbanizeClient } from "./kanbanize/client.js";
import { redact } from "./kanbanize/errors.js";
import { registerTools } from "./tools/register.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const client = new KanbanizeClient({ config });
  const server = new McpServer({ name: "fac-apropriacao-mcp", version: "0.1.0" });
  registerTools(server, client);
  await server.connect(new StdioServerTransport());
}

main().catch((error: unknown) => {
  const secret = process.env.KANBANIZE_API_KEY ?? "";
  const raw = error instanceof Error ? error.message : "Falha ao iniciar o servidor.";
  const message = redact(raw, secret).trim() || "Falha ao iniciar o servidor.";
  console.error(message);
  process.exit(1);
});
