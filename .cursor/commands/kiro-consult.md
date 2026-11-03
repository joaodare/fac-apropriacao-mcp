# Kiro consult (segunda opinião sobre plano)

Use ANTES de implementar. Bug de design é o mais caro de corrigir depois.

Resuma o plano/decisão atual em no máximo 15 linhas (objetivo, abordagem, alternativas descartadas, riscos conhecidos) e rode:

```bash
scripts/kiro-review.sh consult "<resumo>"
```

Depois mostre:
- Onde você e o Kiro concordam
- Onde discordam, e quem tem o melhor argumento (seja honesto se for o Kiro)
- O que muda no plano, se algo mudar

Se o Kiro apontar uma falha concreta, registre: `scripts/kiro-log.sh <REVIEW_ID> P1 <decisao> "plano" "<resumo>"`.
