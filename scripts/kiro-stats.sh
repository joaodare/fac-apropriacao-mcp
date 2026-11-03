#!/usr/bin/env bash
# Mostra se o Kiro está valendo o custo.
#
# Uso: scripts/kiro-stats.sh [dias]   (default: todo o histórico)
#
# Como ler:
#   precisão  = aceito / (aceito + rejeitado + falso_positivo)   -> quanto do que ele aponta é útil
#   falso positivo alto (> ~40%) -> o prompt ou o modelo do revisor estão ruins; ajuste ou troque
#   precisão baixa (< ~25%) por semanas -> o revisor custa mais atenção do que devolve; considere cortar
#   P0 aceitos -> o número que mais importa: bugs graves que passariam sem ele

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
F="$ROOT/.ai-reviews/findings.tsv"
R="$ROOT/.ai-reviews/reviews.tsv"
DAYS="${1:-}"

SINCE=""
if [ -n "$DAYS" ]; then
  SINCE="$(date -d "-$DAYS days" +%Y%m%d 2>/dev/null || date -v-"$DAYS"d +%Y%m%d)"
fi

echo "== Execuções do revisor${DAYS:+ (últimos $DAYS dias)} =="
if [ -f "$R" ]; then
  awk -F'\t' -v since="$SINCE" 'NR>1 { d=substr($1,1,8); if (since!="" && d<since) next;
      n++; v[$3]++; m[$2]++ }
    END { if (!n) { print "  nenhuma"; exit }
      printf "  total: %d\n", n
      printf "  por modo:"; for (k in m) printf " %s=%d", k, m[k]; print ""
      printf "  vereditos:"; for (k in v) printf " %s=%d", k, v[k]; print "" }' "$R"
else
  echo "  nenhuma (reviews.tsv não existe)"
fi

echo
echo "== Triagem dos achados =="
if [ ! -f "$F" ]; then
  echo "  nenhum achado registrado. Use scripts/kiro-log.sh depois de cada triagem."
  exit 0
fi

awk -F'\t' -v since="$SINCE" '
  NR>1 { d=substr($2,1,8); if (since!="" && d<since) next;
    n++; dec[$5]++; sev[$4]++; sd[$4","$5]++; md[$3","$5]++; mode[$3]=1 }
  function prec(a,r,f) { t=a+r+f; return t ? sprintf("%.0f%%", 100*a/t) : "-" }
  END {
    if (!n) { print "  nenhum achado no período"; exit }
    a=dec["aceito"]+0; r=dec["rejeitado"]+0; f=dec["falso_positivo"]+0; i=dec["incerto"]+0
    printf "  achados: %d | aceito %d | rejeitado %d | falso_positivo %d | incerto %d\n", n, a, r, f, i
    printf "  PRECISÃO GERAL: %s   (falso positivo: %s)\n", prec(a,r,f), (a+r+f ? sprintf("%.0f%%",100*f/(a+r+f)) : "-")
    print ""
    print "  por severidade:"
    split("P0 P1 P2", S, " ")
    for (k=1;k<=3;k++) { s=S[k]; if (!sev[s]) continue
      printf "    %s: %d achados, %d aceitos, precisão %s\n", s, sev[s], sd[s",aceito"]+0,
        prec(sd[s",aceito"]+0, sd[s",rejeitado"]+0, sd[s",falso_positivo"]+0) }
    print ""
    print "  por modo:"
    for (m in mode) printf "    %s: precisão %s (%d aceitos)\n", m,
      prec(md[m",aceito"]+0, md[m",rejeitado"]+0, md[m",falso_positivo"]+0), md[m",aceito"]+0
  }' "$F"
