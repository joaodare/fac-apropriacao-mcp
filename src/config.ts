/** Board único deste servidor. A resolução não diferencia maiúsculas. */
export const BOARD_FIXO = "IA FacPlan";

export interface AppConfig {
  apiKey: string;
  subdomain: string;
}

const SUBDOMAIN = /^[a-z0-9-]+$/i;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const apiKey = env.KANBANIZE_API_KEY?.trim() ?? "";
  if (!apiKey) {
    throw new Error("KANBANIZE_API_KEY não está definida.");
  }
  const subdomain = env.KANBANIZE_SUBDOMAIN?.trim() || "grupofacil";
  if (!SUBDOMAIN.test(subdomain)) {
    throw new Error("KANBANIZE_SUBDOMAIN inválido.");
  }
  return { apiKey, subdomain };
}
