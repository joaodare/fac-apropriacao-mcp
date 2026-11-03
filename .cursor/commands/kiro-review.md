# Kiro review (segunda opinião)

Rode no terminal, sem alterar nada antes:

```bash
scripts/kiro-review.sh review
```

Exit codes: 0 PASS · 1 FAIL · 2 erro de setup/kiro-cli · 3 inconclusivo/timeout/sem diff · 4 quality gate falhou.

- **Exit 4:** o Kiro nem foi chamado. Corrija lint/tipos/testes e rode de novo. Não use `KIRO_SKIP_PRECHECK` sem minha autorização.
- **Exit 2 ou timeout:** diga o motivo e pare. Não tente "revisar você mesmo" no lugar do Kiro.

Depois de uma revisão com achados:
1. Leia a saída inteira e anote o `REVIEW_ID` da última linha.
2. Para CADA achado, verifique no código e classifique:
   - **aceito**: problema real, com evidência que você conferiu
   - **rejeitado**: real em tese, mas não se aplica aqui (explique)
   - **falso_positivo**: o revisor errou (cite o arquivo:linha que prova)
   - **incerto**: não dá para confirmar
3. Registre CADA decisão:
   ```bash
   scripts/kiro-log.sh <REVIEW_ID> <P0|P1|P2> <decisao> "<arquivo:linha>" "<resumo curto>"
   ```
4. Mostre a tabela de triagem. Não aplique correções sem minha aprovação.

Seja honesto na triagem: discordar do Kiro quando ele está errado é tão importante quanto aceitar quando está certo. As métricas só servem se as decisões forem reais.
