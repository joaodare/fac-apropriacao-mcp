# MCP Kanbanize v1 — critérios de aceite

Servidor MCP stdio em TypeScript (`@modelcontextprotocol/sdk` + Zod), Node 20, nesta pasta. Só API v2 do Businessmap. Chave só por ambiente (`KANBANIZE_API_KEY`, `KANBANIZE_SUBDOMAIN` com padrão `grupofacil`), header `apikey`. Spec de domínio: `D:\Factory\Saude\fac-apropriacao` (não copiar código nem segredo).

## Tools

Nomes em português. Resposta curta: id, título, board, coluna, raia, dono, prioridade, campos nome/valor e horas.

- [ ] Leitura: `whoami`, `listar_boards`, `buscar_cards`, `obter_card`, `listar_campos`, `listar_horas`
- [ ] Escrita: `lancar_horas`, `alterar_horas`, `excluir_horas`, `criar_card`, `atualizar_card`
- [ ] A chave não é argumento de nenhuma tool

## Tempo

- [ ] A tool recebe e devolve horas; o body da API v2 manda `time` em segundos
- [ ] `segundos = round(horas * 3600)`
- [ ] Mínimo 0,01 h (36 s); máximo 6.000.000 s
- [ ] Não repetir o PUT antigo que envia horas no campo `time`

## Datas e nomes

- [ ] Data no formato `YYYY-MM-DD`; data futura é recusada
- [ ] Board, coluna, raia, tipo e campo customizado resolvem por nome, case-insensitive
- [ ] Coluna e raia respeitam `workflow_id`
- [ ] Nome com ponto usa o último segmento
- [ ] Dropdown: texto da opção vira `value_id` quando a API exigir id (`allowedValues` do board; se vazio, o global)

## Busca, horas e escrita

- [ ] `buscar_cards` usa o board fixo IA FacPlan, ou um id de card desse board; página limitada a 100; não varre outros boards
- [ ] Filtro de título, ocorrência ou WBS que a API não aplique no servidor filtra a página e avisa truncamento
- [ ] `lancar_horas` grava no usuário da chave (`GET /api/v2/me`); sem `user_id` de terceiro
- [ ] `PATCH` é parcial e não reenvia a descrição inteira ao mexer em campo, salvo se o OpenAPI da conta mostrar que o campo é apagado quando omitido
- [ ] `comment` versus `description` e o body de `POST /cards` conferidos em `https://grupofacil.kanbanize.com/openapi/json`

## Erros e segurança

- [ ] `RL02` faz retry com `retry_after`
- [ ] `ARU5` e `C191` viram frase curta em português, sem corpo cru e sem chave
- [ ] A API key nunca aparece em log nem em resposta
- [ ] Nenhuma chave de `D:\Factory\Saude\fac-apropriacao` (incluindo `AppTeste/Program.cs`) entra no projeto

## Testes e entrega

- [ ] Vitest sem rede: conversão de horas, resolução de nome, parse de erro, body de lançamento em segundos
- [ ] `scripts/check.sh` roda `tsc` e os testes
- [ ] `.env.example` sem chave real; README com o bloco `mcp.json` (`node dist/index.js`), sem chave real

## Fora de escopo

Não entregar nesta versão: mover card, comentário, cronômetro, encerrar reunião FAC, checklist de saída, lançar hora em nome de outra pessoa.
