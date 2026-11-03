# fac-apropriacao-mcp

Servidor MCP stdio para o agente lançar horas, criar cards e atualizar campos no Businessmap (Kanbanize). Só a API v2. O repositório C# em `D:\Factory\Saude\fac-apropriacao` é especificação de domínio (Service, resolvers de coluna/raia, conversão `Tempo / 3600`). Não é biblioteca e não entra neste projeto. Nenhuma chave de lá, inclusive `AppTeste/Program.cs`, pode ser copiada.

## Stack

TypeScript, Node 20, `@modelcontextprotocol/sdk`, Zod, Vitest.

## Comandos

- `npm install`
- `npm run build`
- `npm test`
- `scripts/check.sh` — `tsc` e testes (quality gate)

## Pastas

- `src/index.ts` — servidor stdio
- `src/config.ts` — ambiente
- `src/kanbanize/client.ts` — HTTP, retry `RL02`, erros
- `src/kanbanize/time.ts`, `resolvers.ts`, `errors.ts`
- `src/tools/*.ts` — um arquivo por grupo de tools
- `test/` — Vitest, sem rede
- `scripts/check.sh`, `.env.example`, `README.md`

Fluxo: agente → servidor stdio → tools → resolvers e cliente v2 → API Businessmap.

## Configuração

`KANBANIZE_API_KEY` e `KANBANIZE_SUBDOMAIN` (padrão `grupofacil`). Header `apikey`. A chave nunca é argumento de tool, log ou resposta.

## Domínio

- A tool fala **horas**. Na v2, `time` é **segundos**: `segundos = round(horas * 3600)`. Mínimo 0,01 h (36 s). Máximo 6.000.000 s. Não enviar horas no campo `time`.
- Data `YYYY-MM-DD`. Data futura é recusada.
- O board é fixo: `IA FacPlan` (`BOARD_FIXO`). As tools não recebem board. Coluna, raia, tipo e campo customizado resolvem por nome, sem diferenciar maiúsculas. Coluna e raia respeitam `workflow_id`. Nome com ponto usa o último segmento.
- Dropdown: o texto da opção vira `value_id` quando a API exigir id (`allowedValues` do board; se vazio, o global).
- `buscar_cards` usa o board fixo, ou um id de card desse board. Página de no máximo 100. Filtro de título, ocorrência ou WBS que a API não aplique no servidor é feito na página, com aviso de truncamento. Não varrer outros boards.
- `lancar_horas` grava no usuário da chave (`GET /api/v2/me`). Sem `user_id` de terceiro.
- `RL02` faz retry com `retry_after`. `ARU5` e `C191` viram frase curta em português, sem corpo cru e sem chave.
- `PATCH` é parcial. Não reenviar a descrição inteira ao alterar um campo, salvo se o OpenAPI da conta (`https://grupofacil.kanbanize.com/openapi/json`) mostrar que o campo some quando omitido. Conferir `comment` versus `description` e o body de `POST /cards` nesse OpenAPI.

## Tools v1

Nomes em português. Resposta curta: id, título, board, coluna, raia, dono, prioridade, campos nome/valor, horas.

Leitura: `whoami`, `listar_boards`, `buscar_cards`, `obter_card`, `listar_campos`, `listar_horas`.

Escrita: `lancar_horas`, `alterar_horas`, `excluir_horas`, `criar_card`, `atualizar_card`.

## Fora desta entrega

Mover card, comentário, cronômetro, encerrar reunião FAC, checklist de saída e lançar hora em nome de outra pessoa.

## Segurança

Não logar nem devolver a API key. Não trazer segredo do repositório antigo. Testes não usam rede nem chave real.
