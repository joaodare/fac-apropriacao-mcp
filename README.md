# fac-apropriacao-mcp

Servidor MCP stdio para lançar horas, criar cards e atualizar campos no Businessmap (API v2).

## Configuração

O servidor lê só variáveis de ambiente; ele não carrega `.env`. Defina as variáveis no bloco `env` do `mcp.json` (abaixo) ou exporte no shell. `.env.example` lista os nomes. O padrão do subdomínio é `grupofacil`.

```
KANBANIZE_API_KEY=
KANBANIZE_SUBDOMAIN=grupofacil
```

A chave vai no header `apikey`. Ela não é argumento de tool, não entra em log e não volta na resposta.

## Comandos

```bash
npm install
npm run build
npm test
bash scripts/check.sh
```

`scripts/check.sh` roda o typecheck e os testes. Os testes não usam rede.

O processo fala JSON-RPC no stdout. Diagnóstico de falha na subida vai para o stderr.

## Cursor

No `mcp.json` do Cursor, aponte para o build. Não cole uma chave real neste repositório e não versione um `mcp.json` preenchido.

```json
{
  "mcpServers": {
    "fac-apropriacao": {
      "command": "node",
      "args": ["D:/Factory/Saude/fac-apropriacao-mcp/dist/index.js"],
      "env": {
        "KANBANIZE_API_KEY": "SUA_CHAVE",
        "KANBANIZE_SUBDOMAIN": "grupofacil"
      }
    }
  }
}
```

Substitua `SUA_CHAVE` no arquivo local do Cursor. O valor de exemplo acima não é uma chave.

## Contrato conferido no OpenAPI

Em `https://grupofacil.kanbanize.com/openapi/json` (03/11/2026):

- `POST /loggedTime` e `PATCH /loggedTime/{id}` usam `time` em segundos e `comment`. Não há `description` nesse body.
- `POST /cards` e `PATCH /cards/{id}` usam `description`. Comentário de card é outro recurso e não entra nesta versão.
- O OpenAPI não diz que omitir `description` no PATCH apaga o texto. A tool só envia `description` quando a descrição é alterada.
- Criar card usa `column_id` e `lane_id`. Não há `board_id` nesse body.
- Dropdown no card vai em `selected_values_to_add_or_update[].value_id`.
- `priority`: 1 Crítica, 2 Alta, 3 Média, 4 Baixa.
- `GET /loggedTime/{id}` traz `user_id`; alterar e excluir horas recusam lançamento de outro usuário.

O recorte usado nos testes está em `test/fixtures/openapi-recorte.json`.
