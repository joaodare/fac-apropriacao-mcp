# Kiro task check (o diff cumpre a task?)

Pergunte qual arquivo de task/spec usar se eu não tiver dito (ex.: `.kiro/specs/<feature>/tasks.md` ou um `.md` com critérios de aceite). Então rode:

```bash
scripts/kiro-review.sh task <arquivo-da-task>
```

Exit 4 = quality gate falhou (corrija antes). Exit 2/3 = diga o motivo e pare.

Depois:
1. Monte a lista requisito → CUMPRIDO / PARCIAL / NÃO CUMPRIDO, conferindo você mesmo a evidência que o Kiro citou.
2. Destaque separadamente o que foi feito FORA do escopo.
3. Achados [P0/P1/P2] que o Kiro listar: triagem e registro com `scripts/kiro-log.sh`, igual ao `/kiro-review`.
4. Para cada PARCIAL/NÃO CUMPRIDO, proponha o próximo passo, mas não implemente sem minha aprovação.
