-- ============================================================================
-- VIEW:   VW_ALERTA_FERIAS_A_VENCER
-- DEV:    Alerta de Ferias a Vencer
-- ----------------------------------------------------------------------------
-- OBJETIVO:
--   Lista funcionarios cujo limite de gozo de ferias esta se aproximando do
--   vencimento (janela de 90 dias), para acao preventiva do RH antes de gerar
--   dobra trabalhista. E a unica fonte da verdade sobre QUEM deve ser avisado
--   no caminho do painel HTML5.
--
-- ORIGEM FUNCIONAL: relatorio Jasper "Alerta de Ferias a Vencer (V20)".
--
-- SEQUENCIA: exposta porque a rotina Java usa (CODEMP, CODFUNC, SEQUENCIA)
--   como chave da tabela de deduplicacao AD_FERIAS_NOTIFICADO. Sem esta
--   coluna na view, o modo DIFF nao consegue registrar quem ja foi avisado.
-- PROCEDENCIA: CONFIRMADO - validada com key user.
--
-- NOTA SOBRE O "+330":
--   DTFINAQUI e o fim do periodo aquisitivo; +330 aproxima o fim do periodo
--   concessivo (~12 meses da CLT). Esta e a maior suposicao do modelo. O
--   calculo mais preciso seria:
--       ADD_MONTHS(DTFINAQUI,12) - (NUMDIASFER+10) + 1
--   Confirmar com o RH se os 330 dias fixos batem com a regua real.
-- ============================================================================
CREATE OR REPLACE VIEW VW_ALERTA_FERIAS_A_VENCER AS
SELECT
    FUN.CODEMP,
    EMP.RAZAOSOCIAL,
    FUN.CODFUNC,
    FUN.NOMEFUNC,
    FUN.CODDEP,
    DEP.DESCRDEP,
    FUN.CODCARGO,
    CAR.DESCRCARGO,
    FUN.AD_LIDER,
    FUN.AD_EMAILLIDER,
    FER.SEQUENCIA,
    FER.DTINIAQUI,
    FER.DTFINAQUI,
    FER.DTFINAQUI + 330                                        AS LIMGOZO,
    (FER.DTFINAQUI + 330) - TRUNC(SYSDATE)                     AS DIAS_PARA_VENCER,
    FER.DTSAIDA,
    FER.NUMDIASFER,
    FER.DTSAIDA + FER.NUMDIASFER - 1                           AS RETORNO,
    COUNT(*) OVER (PARTITION BY FUN.CODFUNC)                   AS QTD_PERIODOS_NA_JANELA,
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM   TFPREQ REQ
            INNER JOIN TFPREQADM ADM ON ADM.ID = REQ.ORIGEMID
            WHERE  REQ.ORIGEMTIPO = 'V'
              AND  REQ.STATUS     = 1              -- pendente (nao aprovada)
              AND  REQ.CODFUNC    = FUN.CODFUNC
        ) THEN 'N'
        ELSE 'S'
    END                                                         AS ENVIAR_SINO
FROM   TFPFER FER
INNER JOIN TFPFUN FUN ON FUN.CODEMP = FER.CODEMP AND FUN.CODFUNC = FER.CODFUNC
INNER JOIN TSIEMP EMP ON EMP.CODEMP = FUN.CODEMP
LEFT  JOIN TFPDEP DEP ON DEP.CODDEP = FUN.CODDEP
LEFT  JOIN TFPCAR CAR ON CAR.CODCARGO = FUN.CODCARGO
WHERE  EMP.CODEMP  >= 20
  AND  FUN.SITUACAO NOT IN (0, 2, 8, 9)   -- Demitido, Afastado s/ remun., Transferido, Aposent. invalidez
  AND  FUN.VINCULO  NOT IN (80, 90)
  AND  FUN.DTDEM IS NULL
  AND  (FER.DTFINAQUI + 330) BETWEEN TRUNC(SYSDATE) AND TRUNC(SYSDATE) + 90
  AND  FER.NUMDIASFER <> 0
  AND  FER.DTSAIDA    IS NULL
  AND  FER.DTPREVISTA IS NULL
  AND  NVL(FER.ATUALFERGOZ, 'N') <> 'S'
  AND  NOT EXISTS (
        SELECT 1
        FROM   TFPREQ REQ
        INNER JOIN TFPREQADM ADM ON ADM.ID = REQ.ORIGEMID
        WHERE  REQ.ORIGEMTIPO = 'V'
          AND  REQ.STATUS     = 2                  -- ja aprovada: sai da view
          AND  REQ.CODFUNC    = FUN.CODFUNC
    );
