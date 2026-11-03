#!/usr/bin/env bash
# Registra a decisão de triagem de UM achado do Kiro. É isso que permite medir se o revisor vale o custo.
#
# Uso:
#   scripts/kiro-log.sh <review_id> <P0|P1|P2> <decisao> "<arquivo:linha>" "<resumo curto>"
#
# decisao:
#   aceito          problema real, foi (ou será) corrigido
#   rejeitado       problema real em tese, mas não se aplica aqui / custo > benefício
#   falso_positivo  o revisor errou (o problema não existe)
#   incerto         ninguém conseguiu confirmar; ficou para o humano
#
# Ex.: scripts/kiro-log.sh 20261103-074500-review P1 aceito "src/auditoria.py:88" "timeout sem retry"

set -euo pipefail

[ "$#" -ge 4 ] || { sed -n '2,13p' "$0" >&2; exit 2; }

REVIEW_ID="$1"; SEV="$2"; DECISION="$3"; LOC="$4"; SUMMARY="${5:-}"

case "$SEV" in P0|P1|P2) ;; *) echo "ERRO: severidade inválida '$SEV' (use P0, P1 ou P2)" >&2; exit 2;; esac
case "$DECISION" in aceito|rejeitado|falso_positivo|incerto) ;;
  *) echo "ERRO: decisão inválida '$DECISION' (use aceito, rejeitado, falso_positivo ou incerto)" >&2; exit 2;; esac

ROOT="$(git rev-parse --show-toplevel)"
DIR="$ROOT/.ai-reviews"
LOG="$DIR/findings.tsv"
mkdir -p "$DIR"

[ -f "$DIR/$REVIEW_ID.md" ] || echo "AVISO: não achei .ai-reviews/$REVIEW_ID.md (review_id digitado errado?). Registrando mesmo assim." >&2
[ -f "$LOG" ] || printf 'logged_at\treview_id\tmode\tseverity\tdecision\tlocation\tsummary\n' > "$LOG"

clean() { printf '%s' "$1" | tr '\t\n\r' '   '; }
MODE="${REVIEW_ID##*-}"

printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
  "$(date +%Y-%m-%dT%H:%M:%S)" "$(clean "$REVIEW_ID")" "$(clean "$MODE")" "$SEV" "$DECISION" "$(clean "$LOC")" "$(clean "$SUMMARY")" >> "$LOG"

echo "ok: $SEV $DECISION $LOC"
