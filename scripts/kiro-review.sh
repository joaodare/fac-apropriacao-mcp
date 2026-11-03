#!/usr/bin/env bash
# Ponte Cursor -> Kiro CLI (headless). Kiro só LÊ; quem decide e aplica é o Cursor + você.
#
# Uso:
#   scripts/kiro-review.sh review                 # revisa o diff atual vs base
#   scripts/kiro-review.sh challenge              # modo adversarial: tenta quebrar o código
#   scripts/kiro-review.sh task <arquivo-spec>    # valida se o diff cumpre a task/spec
#   scripts/kiro-review.sh consult "pergunta"     # segunda opinião sobre plano/abordagem
#
# Env opcionais:
#   KIRO_BASE          ref base do diff (default: merge-base com origin/main ou origin/master)
#   KIRO_AGENT         agente custom do Kiro (default: reviewer; o modelo fica no JSON do agente)
#   KIRO_AGENT_DISABLE=1   não passa --agent (se sua versão do kiro-cli não aceitar a flag)
#   KIRO_TIMEOUT       segundos (default: 600)
#   KIRO_MAX_DIFF      bytes máximos de diff enviados inline (default: 200000)
#   KIRO_MAX_LINES     acima disso, avisa que o diff está grande demais (default: 400)
#   KIRO_PRECHECK      comando do quality gate (default: scripts/check.sh se existir)
#   KIRO_SKIP_PRECHECK=1   pula o quality gate (use só quando souber o porquê)
#
# Exit codes:
#   0 PASS | 1 FAIL | 2 erro de setup/kiro-cli | 3 inconclusivo/timeout/sem diff | 4 quality gate falhou
#
# Cada execução gera:
#   .ai-reviews/<REVIEW_ID>.md   saída completa do Kiro
#   .ai-reviews/reviews.tsv      1 linha por execução (veredito e contagem P0/P1/P2)

set -euo pipefail

MODE="${1:-review}"
shift || true

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "ERRO: rode dentro de um repo git" >&2; exit 2; }
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

BASE="${KIRO_BASE:-$(git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD origin/master 2>/dev/null || echo HEAD)}"
AGENT="${KIRO_AGENT:-reviewer}"
TIMEOUT_S="${KIRO_TIMEOUT:-600}"
MAX_DIFF="${KIRO_MAX_DIFF:-200000}"
MAX_LINES="${KIRO_MAX_LINES:-400}"

OUT_DIR="$ROOT/.ai-reviews"
mkdir -p "$OUT_DIR"
REVIEW_ID="$(date +%Y%m%d-%H%M%S)-$MODE"
OUT="$OUT_DIR/$REVIEW_ID.md"
REVIEWS_LOG="$OUT_DIR/reviews.tsv"
[ -f "$REVIEWS_LOG" ] || printf 'review_id\tmode\tverdict\tp0\tp1\tp2\tcommit\tdiff_lines\n' > "$REVIEWS_LOG"

# Nunca revisar a própria saída, mesmo que .ai-reviews/ não esteja no .gitignore.
PATHSPEC=(-- . ':(exclude).ai-reviews')

# ---------- contexto: diff + arquivos novos ----------
build_diff() {
  local d untracked
  d="$(git diff "$BASE" --stat "${PATHSPEC[@]}"; echo; git diff "$BASE" "${PATHSPEC[@]}")"
  untracked="$(git ls-files --others --exclude-standard "${PATHSPEC[@]}")"
  if [ -n "$untracked" ]; then
    d="$d"$'\n\n# ARQUIVOS NOVOS (não rastreados) — leia-os com a ferramenta read:\n'"$untracked"
  fi
  if [ "${#d}" -gt "$MAX_DIFF" ]; then
    d="${d:0:$MAX_DIFF}"$'\n\n# [DIFF TRUNCADO — use read/grep nos arquivos listados no --stat acima]'
  fi
  printf '%s' "$d"
}

diff_lines() {
  local tracked untracked=0 f
  tracked="$(git diff "$BASE" --numstat "${PATHSPEC[@]}" | awk '{a+=$1; d+=$2} END {print a+d+0}')"
  while IFS= read -r f; do
    [ -n "$f" ] && [ -f "$f" ] && untracked=$((untracked + $(wc -l < "$f")))
  done < <(git ls-files --others --exclude-standard "${PATHSPEC[@]}")
  echo $((tracked + untracked))
}

OUTPUT_CONTRACT='
Siga as convenções e regras de domínio de AGENTS.md (leia o arquivo se ainda não o tiver no contexto).

FORMATO OBRIGATÓRIO DA RESPOSTA (em português):
- Uma linha por achado: [P0|P1|P2] caminho/arquivo:linha — problema — por que importa — correção sugerida
  P0 = bug/segurança/perda de dados/vazamento de dado sensível; P1 = comportamento errado ou risco real; P2 = melhoria.
- Não liste estilo/nitpick a menos que esconda bug. Lint, typecheck e testes já passaram antes desta revisão.
- Se não tiver certeza, diga "INCERTO:" e o que precisaria verificar. Não invente.
- Você NÃO pode editar arquivos. Apenas leia e reporte.
- A ÚLTIMA linha deve ser exatamente uma de:
  VERDICT: PASS
  VERDICT: FAIL
  VERDICT: NEEDS_DISCUSSION
  (FAIL se houver qualquer P0, ou P1 sem justificativa aceitável.)'

case "$MODE" in
  review)
    PROMPT="Você é um revisor de código sênior independente. Outro agente de IA escreveu as mudanças abaixo (diff via stdin). Revise correção, casos de borda, tratamento de erro, segurança, concorrência, performance óbvia e testes ausentes. Leia arquivos do repo quando precisar de contexto.$OUTPUT_CONTRACT"
    ;;
  challenge)
    PROMPT="Modo adversarial. Seu objetivo é QUEBRAR o código do diff abaixo (via stdin): entradas maliciosas ou inesperadas, nulos, limites, falhas de rede/IO, race conditions, injeção, autorização ausente, vazamento de dados pessoais/sensíveis em logs ou respostas. Para cada ataque plausível, descreva o input concreto que quebra.$OUTPUT_CONTRACT"
    ;;
  task)
    SPEC="${1:-}"
    [ -n "$SPEC" ] && [ -f "$SPEC" ] || { echo "ERRO: informe o arquivo da task/spec. Ex: .kiro/specs/minha-feature/tasks.md" >&2; exit 2; }
    PROMPT="Valide se as mudanças (diff via stdin) cumprem a task/spec em '$SPEC' (leia o arquivo). Para cada requisito/critério de aceite: CUMPRIDO / PARCIAL / NÃO CUMPRIDO, com evidência (arquivo:linha). Aponte também o que foi feito FORA do escopo da task.$OUTPUT_CONTRACT"
    ;;
  consult)
    Q="${*:-}"
    [ -n "$Q" ] || { echo "ERRO: informe a pergunta" >&2; exit 2; }
    PROMPT="Dê uma segunda opinião independente e crítica. Comece pelo ponto mais fraco da proposta; não valide por padrão. Leia AGENTS.md e o repo se precisar de contexto. Pergunta/proposta: $Q
Termine com uma linha 'VERDICT: PASS' (proposta sólida), 'VERDICT: FAIL' (tem falha séria) ou 'VERDICT: NEEDS_DISCUSSION'."
    ;;
  *)
    echo "Modo inválido: $MODE (use review|challenge|task|consult)" >&2; exit 2;;
esac

LINES=0
INPUT=""
if [ "$MODE" != "consult" ]; then
  if [ -z "$(git diff "$BASE" --name-only "${PATHSPEC[@]}")$(git ls-files --others --exclude-standard "${PATHSPEC[@]}")" ]; then
    echo "Nada para revisar: sem diff em relação a $BASE." >&2
    exit 3
  fi

  # ---------- quality gate: o que é determinístico vem antes da opinião de modelo ----------
  PRECHECK="${KIRO_PRECHECK:-}"
  if [ -z "$PRECHECK" ] && [ -x scripts/check.sh ]; then PRECHECK="scripts/check.sh"; fi
  if [ -n "${KIRO_SKIP_PRECHECK:-}" ]; then
    echo "AVISO: quality gate pulado (KIRO_SKIP_PRECHECK)." >&2
  elif [ -n "$PRECHECK" ]; then
    echo "Quality gate: $PRECHECK" >&2
    if ! bash -c "$PRECHECK" >&2; then
      echo "QUALITY GATE FALHOU: corrija lint/typecheck/testes antes de chamar o revisor. O Kiro não foi chamado." >&2
      exit 4
    fi
  else
    echo "AVISO: sem quality gate (crie scripts/check.sh ou defina KIRO_PRECHECK)." >&2
  fi

  LINES="$(diff_lines)"
  if [ "$LINES" -gt "$MAX_LINES" ]; then
    echo "AVISO: diff com $LINES linhas (limite $MAX_LINES). A qualidade da revisão cai muito em diffs grandes; considere quebrar a task." >&2
  fi
  INPUT="$(build_diff)"
fi

command -v kiro-cli >/dev/null 2>&1 || { echo "ERRO: kiro-cli não encontrado no PATH" >&2; exit 2; }

# ---------- execução ----------
# Modelo: definido no campo "model" de .kiro/agents/reviewer.json (headless não tem /model).
CMD=(kiro-cli chat --no-interactive --trust-tools=read,grep)
[ -n "${KIRO_AGENT_DISABLE:-}" ] || CMD+=(--agent "$AGENT")
CMD+=("$PROMPT")

TO=()
if command -v timeout >/dev/null 2>&1; then TO=(timeout "$TIMEOUT_S")
elif command -v gtimeout >/dev/null 2>&1; then TO=(gtimeout "$TIMEOUT_S"); fi

strip_ansi() {
  if command -v perl >/dev/null 2>&1; then perl -pe 's/\e\[[0-9;?]*[A-Za-z]//g'
  else cat; fi
}

echo "Kiro [$MODE] base=$BASE agent=$AGENT review_id=$REVIEW_ID" >&2

set +e
printf '%s' "$INPUT" | NO_COLOR=1 ${TO[@]+"${TO[@]}"} "${CMD[@]}" 2>&1 | strip_ansi > "$OUT"
RC=${PIPESTATUS[1]}
set -e

cat "$OUT"
echo
echo "REVIEW_ID: $REVIEW_ID"

VERDICT="$(grep -Eo 'VERDICT: (PASS|FAIL|NEEDS_DISCUSSION)' "$OUT" | tail -n1 | sed 's/VERDICT: //' || true)"
count() { grep -cE "^[^A-Za-z0-9]*\[$1\]" "$OUT" || true; }
P0="$(count P0)"; P1="$(count P1)"; P2="$(count P2)"

if [ "$RC" -eq 124 ]; then
  VERDICT="TIMEOUT"
elif [ "$RC" -ne 0 ] && [ -z "$VERDICT" ]; then
  VERDICT="KIRO_ERROR"
fi
printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
  "$REVIEW_ID" "$MODE" "${VERDICT:-NONE}" "$P0" "$P1" "$P2" "$(git rev-parse --short HEAD 2>/dev/null || echo -)" "$LINES" >> "$REVIEWS_LOG"

case "${VERDICT:-NONE}" in
  PASS) exit 0 ;;
  FAIL) exit 1 ;;
  TIMEOUT) echo "Kiro estourou o timeout de ${TIMEOUT_S}s." >&2; exit 3 ;;
  KIRO_ERROR) echo "kiro-cli saiu com código $RC sem veredito (auth? flag inválida? veja a saída acima)." >&2; exit 2 ;;
  *) exit 3 ;;
esac
