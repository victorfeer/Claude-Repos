/* ============================================================================
   STP_NOTIFICA_SISTEMA_CUSTOM

   Procedure de notificação no sininho (SANKHYA.TSIAVI) para o grupo do DP.

   Diferenças em relação à procedure nativa STP_NOTIFICA_SISTEMA:
   - P_CODGRUPO removido da assinatura — código do grupo do DP está fixo
     na constante C_CODGRUPO_DP. Substituir pelo valor real do TSIGRU:
         SELECT CODGRUPO, DESCRGRU FROM SANKHYA.TSIGRU WHERE DESCRGRU LIKE '%DP%'
   - P_IMPORTANCIA com DEFAULT 0 (Urgentíssimo) em vez de 3
   - Coluna CODUSUREMETENTE (grafia confirmada via ALL_TAB_COLUMNS no ambiente)
   ============================================================================ */

CREATE OR REPLACE PROCEDURE STP_NOTIFICA_SISTEMA_CUSTOM(
    P_TITULO          VARCHAR2,
    P_DESCRICAO       VARCHAR2,
    P_CODUSU          NUMBER,
    P_CODUSUREMETENTE NUMBER,
    P_IMPORTANCIA     NUMBER DEFAULT 0)
AS
    -- << Substituir pelo código real do grupo do DP >>
    -- SELECT CODGRUPO, DESCRGRU FROM SANKHYA.TSIGRU WHERE DESCRGRU LIKE '%DP%'
    C_CODGRUPO_DP CONSTANT NUMBER := 123;
    V_NUAVISO     NUMBER;
BEGIN
    SELECT NVL(MAX(NUAVISO), 0) + 1 INTO V_NUAVISO FROM SANKHYA.TSIAVI;

    INSERT INTO SANKHYA.TSIAVI (
        NUAVISO,
        TITULO,
        DESCRICAO,
        IDENTIFICADOR,
        IMPORTANCIA,
        CODUSU,
        CODGRUPO,
        TIPO,
        DHCRIACAO,
        CODUSUREMETENTE
    ) VALUES (
        V_NUAVISO,
        P_TITULO,
        P_DESCRICAO,
        'API',
        P_IMPORTANCIA,
        P_CODUSU,
        CASE WHEN P_CODUSU IS NOT NULL THEN NULL ELSE C_CODGRUPO_DP END,
        'P',
        SYSDATE,
        P_CODUSUREMETENTE
    );
END;
/
