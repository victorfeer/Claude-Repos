-- ============================================================================
-- PROCEDURE: STP_NOTIFICA_SISTEMA_CUSTOM
-- DEV:       Alerta de Ferias a Vencer
-- ----------------------------------------------------------------------------
-- OBJETIVO:
--   Gravar notificacao na central de avisos (TSIAVI) - pop-up e sininho.
--
-- DIFERENCAS vs. a nativa STP_NOTIFICA_SISTEMA:
--   - P_IMPORTANCIA exposto como parametro (fixo em 3 na nativa), permitindo
--     enviar o alerta como 0 = Urgentissimo.
--   - Coluna CODUSUREMENTI: grafia REAL confirmada na TSIAVI do ambiente.
--     A copia original usava CODUSUREMETENTE, que NAO existe.
--
-- ############################################################################
-- #  ASSINATURA DE 5 PARAMETROS - CONFIRMADA CONTRA O ARTEFATO REAL          #
-- #                                                                          #
-- #  A rotina Java homologada (alertaferias.jar, 10/07/2026) chama:          #
-- #      {call STP_NOTIFICA_SISTEMA_CUSTOM(?, ?, ?, ?, ?)}                   #
-- #  com (titulo, descricao, CODUSU destino, -1 remetente, 0 importancia).   #
-- #                                                                          #
-- #  Ou seja: NAO existe parametro P_CODGRUPO. O destino do aviso e um       #
-- #  CODUSU individual - a rotina percorre uma lista fixa de 8 usuarios e    #
-- #  chama a procedure uma vez para cada um.                                 #
-- #                                                                          #
-- #  Versoes anteriores desta documentacao descreviam 6 parametros, com      #
-- #  P_CODGRUPO. Isso NAO corresponde ao que esta implantado.                #
-- ############################################################################
-- ============================================================================
CREATE OR REPLACE PROCEDURE STP_NOTIFICA_SISTEMA_CUSTOM(
                P_TITULO             VARCHAR2,
                P_DESCRICAO          VARCHAR2,
                P_CODUSU             NUMBER,
                P_CODUSUREMETENTE    NUMBER,
                P_IMPORTANCIA        NUMBER DEFAULT 3)
AS
BEGIN
  DECLARE
    V_NUAVISO NUMBER;
  BEGIN
    SELECT NVL(MAX(NUAVISO), 0)+1 INTO V_NUAVISO FROM TSIAVI;
    INSERT INTO TSIAVI
                (NUAVISO, TITULO, DESCRICAO, IDENTIFICADOR, IMPORTANCIA,
                 CODUSU, CODGRUPO, TIPO, DHCRIACAO, CODUSUREMENTI)
    VALUES      (V_NUAVISO, P_TITULO, P_DESCRICAO, 'API', P_IMPORTANCIA,
                 P_CODUSU, NULL, 'P', SYSDATE, P_CODUSUREMETENTE);
  END;
END;
/

-- ----------------------------------------------------------------------------
-- Chamada de referencia (exatamente como a rotina Java faz):
-- ----------------------------------------------------------------------------
-- BEGIN
--   STP_NOTIFICA_SISTEMA_CUSTOM(
--     P_TITULO          => 'Ferias a vencer - novo alerta',
--     P_DESCRICAO       => 'NOME (EMPRESA - DEPARTAMENTO) | Ferias vencem em N dia(s)',
--     P_CODUSU          => 1716,  -- um dos 8 destinatarios
--     P_CODUSUREMETENTE => -1,    -- -1 = "Sistema"
--     P_IMPORTANCIA     => 0      -- Urgentissimo
--   );
-- END;
-- /

-- ----------------------------------------------------------------------------
-- Destinatarios do sininho (constante CODUSU_DESTINATARIOS da rotina Java):
--   1716, 1945, 1946, 1947, 2365, 3379, 3387, 3388
-- Para conferir quem sao:
--   SELECT CODUSU, NOMEUSU FROM TSIUSU
--    WHERE CODUSU IN (1716,1945,1946,1947,2365,3379,3387,3388);
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- RISCOS MANTIDOS DE PROPOSITO (herdados da nativa):
--   1) NUAVISO via MAX+1 -> risco de race condition em chamadas concorrentes.
--      Agravante: a rotina chama esta procedure 8 vezes por colaborador.
--   2) Ausencia de bloco EXCEPTION.
--
-- TROUBLESHOOTING:
--   Se o CREATE falhar com "pacote vazio, sem membros publicos", existe um
--   objeto remanescente do tipo PACKAGE com o mesmo nome:
--       SELECT OBJECT_NAME, OBJECT_TYPE, STATUS FROM USER_OBJECTS
--        WHERE OBJECT_NAME = 'STP_NOTIFICA_SISTEMA_CUSTOM';
--       DROP PACKAGE STP_NOTIFICA_SISTEMA_CUSTOM;
-- ----------------------------------------------------------------------------
