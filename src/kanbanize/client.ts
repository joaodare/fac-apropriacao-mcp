import { loadConfig, type AppConfig } from "../config.js";
import { DomainError, readRateLimitWait, translateApiError } from "./errors.js";

export interface HttpResponse {
  status: number;
  text(): Promise<string>;
}

export type HttpFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
) => Promise<HttpResponse>;

export type Query = Record<string, string | number | undefined>;

const defaultFetch: HttpFetch = async (url, init) => {
  const response = await fetch(url, init);
  return { status: response.status, text: () => response.text() };
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class KanbanizeClient {
  private readonly apiKey: string;
  private readonly subdomain: string;
  private readonly fetchImpl: HttpFetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly maxAttempts: number;

  constructor(options: {
    config?: AppConfig;
    fetchImpl?: HttpFetch;
    sleep?: (ms: number) => Promise<void>;
    maxAttempts?: number;
  } = {}) {
    const config = options.config ?? loadConfig();
    this.apiKey = config.apiKey;
    this.subdomain = config.subdomain;
    this.fetchImpl = options.fetchImpl ?? defaultFetch;
    this.sleep = options.sleep ?? defaultSleep;
    this.maxAttempts = options.maxAttempts ?? 3;
  }

  get(path: string, query?: Query): Promise<unknown> {
    return this.request("GET", path, { query });
  }

  post(path: string, body: unknown): Promise<unknown> {
    return this.request("POST", path, { body });
  }

  patch(path: string, body: unknown): Promise<unknown> {
    return this.request("PATCH", path, { body });
  }

  delete(path: string): Promise<unknown> {
    return this.request("DELETE", path);
  }

  async request(method: string, path: string, options: { query?: Query; body?: unknown } = {}): Promise<unknown> {
    const headers: Record<string, string> = {
      accept: "application/json",
      apikey: this.apiKey,
    };
    let body: string | undefined;
    if (options.body !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(options.body);
    }
    const url = this.url(path, options.query);
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      let status: number;
      let text: string;
      try {
        const response = await this.fetchImpl(url, { method, headers, body });
        status = response.status;
        text = await response.text();
      } catch {
        throw new DomainError("Falha de rede ao chamar a API. A requisição não foi repetida.");
      }
      if (status >= 200 && status < 300) {
        if (!text) return null;
        try {
          return JSON.parse(text) as unknown;
        } catch {
          throw new DomainError(`Erro HTTP ${status}.`);
        }
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = undefined;
      }
      const wait = readRateLimitWait(parsed);
      if (wait !== null && attempt < this.maxAttempts) {
        await this.sleep(wait * 1000);
        continue;
      }
      throw new DomainError(translateApiError(status, text, this.apiKey));
    }
    throw new DomainError("Falha ao consultar a API.");
  }

  private url(path: string, query?: Query): string {
    const normalized = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(`https://${this.subdomain}.kanbanize.com/api/v2${normalized}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined) continue;
        url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }
}
