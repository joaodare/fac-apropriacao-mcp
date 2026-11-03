# Kiro challenge (modo adversarial)

Rode:

```bash
scripts/kiro-review.sh challenge
```

Exit 4 = quality gate falhou (corrija antes). Exit 2/3 = diga o motivo e pare.

Para cada ataque que o Kiro propôs:
1. Verifique no código se o input concreto realmente quebra (siga o fluxo de dados até o ponto citado).
2. Classifique e registre com `scripts/kiro-log.sh <REVIEW_ID> <sev> <decisao> "<arquivo:linha>" "<resumo>"`:
   - reproduzível → **aceito**
   - já mitigado em outro ponto → **rejeitado** (aponte onde)
   - não procede → **falso_positivo**
   - não deu para confirmar → **incerto**
3. Para os aceitos, proponha um teste que falha antes da correção. Não corrija sem minha aprovação.
