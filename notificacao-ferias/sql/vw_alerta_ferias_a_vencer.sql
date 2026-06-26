-- ============================================================================
-- VW_ALERTA_FERIAS_A_VENCER
-- View que encapsula a query original (já validada com o key user de RH).
-- Sem alteração de lógica em relação à query base.
-- ============================================================================
CREATE OR REPLACE VIEW VW_ALERTA_FERIAS_A_VENCER AS
SELECT DISTINCT
    EMP.RAZAOSOCIAL,
    EMP.CODEMP,
    FORMATAR_CPF_CNPJ(EMP.CGC)                                   AS CNPJ_FORMATADO,
    FUN.CODFUNC                                                  AS CODFUNC,
    FUN.NOMEFUNC                                                 AS NOMEFUNC,
    FUN.DTADM                                                    AS DTADM,
    FUN.CODDEP                                                   AS CODDEP,
    DEP.DESCRDEP                                                 AS DESCRDEP,
    FUN.CODCARGO                                                 AS CODCARGO,
    CAR.DESCRCARGO                                               AS DESCRCARGO,
    FER.SEQUENCIA                                                AS SEQUENCIA,
    FER.DTINIAQUI                                                AS DTINIAQUI,
    FER.DTFINAQUI                                                AS DTFINAQUI,
    FER.DTPREVISTA                                               AS DTPREVISTA,
    FER.DTSAIDA                                                  AS DTSAIDA,
    FER.DTSAIDA + (FER.NUMDIASFER - 1)                           AS RETORNO,
    FER.NUMDIASFER                                               AS NUMDIASFER,
    NVL(FER.FALTPER, 0)                                          AS FALTAS,
    ADD_MONTHS(FER.DTFINAQUI, 12) - (FER.NUMDIASFER + 10) + 1    AS LIMGOZO,
    NVL(FER.ABONOPEC, 0)                                         AS ABONOPEC,
    FUN.AD_LIDER                                                 AS LIDER
FROM
    TFPFER FER,
    TFPFUN FUN,
    TFPDEP DEP,
    TFPCAR CAR,
    TSIEMP EMP
WHERE
        FER.CODEMP >= 20
    AND FUN.CODFUNC = FER.CODFUNC
    AND FUN.CODEMP  = FER.CODEMP
    AND FUN.CODCARGO = CAR.CODCARGO
    AND FUN.CODDEP   = DEP.CODDEP
    AND FUN.CODEMP   = EMP.CODEMP
    AND FUN.SITUACAO NOT IN (0, 2, 8, 9)
    AND FUN.VINCULO  NOT IN (80, 90)
    AND FUN.DTDEM IS NULL
    AND (FER.DTFINAQUI + 330) BETWEEN TRUNC(SYSDATE) AND TRUNC(SYSDATE) + 90
    AND FER.NUMDIASFER <> 0
    AND FER.DTSAIDA IS NULL
    AND FER.DTPREVISTA IS NULL
    AND NVL(FER.ATUALFERGOZ, 'N') <> 'S'
    AND NOT EXISTS (
        SELECT 1
        FROM TFPREQ REQ
        INNER JOIN TFPREQADM ADM ON ADM.ID = REQ.ORIGEMID
        WHERE
                REQ.ORIGEMTIPO = 'V'
            AND REQ.STATUS     = 2
            AND REQ.CODFUNC    = FUN.CODFUNC
    )
ORDER BY
    FUN.NOMEFUNC,
    FER.DTINIAQUI DESC,
    FER.SEQUENCIA DESC;
