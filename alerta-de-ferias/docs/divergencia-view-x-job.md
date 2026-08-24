# Divergência entre a view (painel) e a rotina Java (e-mail/sino)

> **Fonte:** comparação entre `VW_ALERTA_FERIAS_A_VENCER` (usada pelo painel
> HTML5) e a consulta embutida no artefato real `alertaferias.jar`
> (projeto `AlertaFeriasHml`, classes de 10/07/2026).

## O ponto central

A documentação do projeto já registrava um risco: *"a regra está em dois lugares
— manter sincronizado é o risco central da arquitetura"*. A comparação com o
artefato real mostra que **os dois lados já divergiram**.

**A rotina Java não consulta a view.** Ela tem SQL próprio, embutido no código,
com regras diferentes. Painel e e-mail podem, portanto, listar pessoas
diferentes.

## Tabela de divergências

| Aspecto | View `VW_ALERTA_FERIAS_A_VENCER` (painel) | Rotina Java (e-mail + sino) |
|---|---|---|
| **Limite de gozo** | `DTFINAQUI + 330` (aproximação) | **`FER.DTLIMGOZFER`** — coluna calculada pelo próprio Sankhya, com fallback `ADD_MONTHS(DTFINAQUI, 12)` quando nula |
| **Janela** | `BETWEEN TRUNC(SYSDATE) AND TRUNC(SYSDATE) + 90` | `DIAS_PARA_VENCER <= 30` (critério A), incluindo negativos |
| **Critério preventivo** | Não implementado na view | `QTD_PERIODOS_ABERTOS = 1 AND DIAS_PARA_COMPLETAR_P2 BETWEEN -30 AND 30` |
| **Período não gozado** | `DTSAIDA IS NULL AND DTPREVISTA IS NULL AND NVL(ATUALFERGOZ,'N') <> 'S' AND NUMDIASFER <> 0` | **`PERQUITADO IS NULL OR PERQUITADO <> 'S'`** |
| **Filtro de empresa** | `EMP.CODEMP >= 20` | **não existe** |
| **Filtro de vínculo** | `FUN.VINCULO NOT IN (80, 90)` | **não existe** |
| **Situação** | `NOT IN (0, 2, 8, 9)` — numérico | `NOT IN ('0','2','8','9')` — **string** |
| **Requisição** | `STATUS = 1` marca pendente; `STATUS = 2` remove da view | **`STATUS <> 2`** marca pendente (qualquer status não aprovado) |
| **Deduplicação** | `COUNT(*) OVER (PARTITION BY CODFUNC)` apenas informa | **`ROW_NUMBER() ... ORDER BY DTINIAQUI` + `WHERE ORDEM_PERIODO = 1`** — mantém o período **mais antigo** |
| **`SEQUENCIA`** | Exposta (correção recente) | Usada como chave de deduplicação do sino |

## Consequências práticas

1. **O painel usa uma aproximação (`+330`) onde o job usa o valor real
   (`DTLIMGOZFER`).** A data de vencimento exibida ao DP pode não bater com a
   do e-mail que ele recebeu.

2. **A janela é diferente:** o painel mostra 90 dias à frente; o job dispara com
   30. Alguém pode aparecer no painel e ainda não ter gerado e-mail.

3. **O painel restringe empresa e vínculo; o job não.** O job pode notificar
   sobre colaborador que o painel não lista.

4. **Deduplicação diferente:** o job fica com o período **mais antigo**
   (`ORDER BY DTINIAQUI`); a documentação do painel descreve manter o de
   **menor `DIAS_PARA_VENCER`** (mais urgente). Nem sempre são o mesmo registro.

5. **Requisição pendente:** o job trata `STATUS <> 2` como pendente — inclui
   status cancelado/rejeitado, se existirem. A view considera pendente só
   `STATUS = 1`.

## Recomendação

Unificar em **uma única fonte**. O caminho de menor risco é **a view passar a
refletir a regra do job** (que é a validada em homologação e a que efetivamente
dispara as notificações), e o job passar a consumir a view:

- Trocar `DTFINAQUI + 330` por `NVL(DTLIMGOZFER, ADD_MONTHS(DTFINAQUI,12))`.
- Trocar os filtros de período gozado por `PERQUITADO`.
- Decidir conscientemente se `CODEMP >= 20` e `VINCULO NOT IN (80,90)` devem
  valer para os dois lados — hoje valem só para o painel.
- Alinhar a janela (90 no painel × 30 no job) ou expor as duas faixas.

Enquanto isso não for feito, **tratar o job como a fonte da verdade** para
"quem foi notificado", e o painel como visão exploratória mais ampla.

## Observação sobre o `+330`

A documentação registrava o `+330` como *"a maior suposição do modelo"* e
recomendava confirmar a régua com o RH. O artefato real **não usa 330**: usa
`DTLIMGOZFER`, que é a régua do próprio ERP. Isso indica que a suposição foi
superada na implementação, mas a view nunca foi atualizada.
