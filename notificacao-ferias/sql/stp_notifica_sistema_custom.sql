/* ============================================================================
   STP_NOTIFICA_SISTEMA_CUSTOM
   Cópia customizada da procedure nativa STP_NOTIFICA_SISTEMA.

   Única mudança funcional em relação à original: adiciona o parâmetro
   P_IMPORTANCIA NUMBER DEFAULT 3, usado no INSERT em vez do valor fixo 3.
   O DEFAULT 3 mantém compatibilidade com chamadas que não informam esse
   parâmetro.

   Também corrige o nome da coluna no INSERT para CODUSUREMENTI (grafia
   real confirmada na tabela TSIAVI — a original tinha CODUSUREMETENTE,
   que não existe na tabela).

   Riscos conhecidos MANTIDOS DE PROPÓSITO (não corrigidos nesta versão):
   - Geração de NUAVISO via MAX+1 (race condition em chamadas concorrentes)
   - Ausência de bloco EXCEPTION

   PENDENTE: "STP_NOTIFICA_SISTEMA_CUSTOM" é nome placeholder — ajustar
   se o ambiente tiver convenção própria para procedures customizadas
   (ex.: prefixo AD_, STP_AD_).
   ============================================================================ */

CREATE OR REPLACE PROCEDURE STP_NOTIFICA_SISTEMA_CUSTOM(
                P_TITULO             VARCHAR2,
                P_DESCRICAO          VARCHAR2,
                P_CODUSU             NUMBER,
                P_CODGRUPO           NUMBER,
                P_CODUSUREMETENTE    NUMBER,
                P_IMPORTANCIA        NUMBER DEFAULT 3)
AS
BEGIN
  DECLARE
    V_CODGRUPO NUMBER;
    V_NUAVISO  NUMBER;
  BEGIN
    IF (P_CODUSU IS NOT NULL) THEN
      V_CODGRUPO := NULL;
    ELSE
      V_CODGRUPO := P_CODGRUPO;
    END IF;

    SELECT NVL(MAX(NUAVISO), 0) + 1 INTO V_NUAVISO FROM TSIAVI;

    INSERT INTO TSIAVI
                (NUAVISO,
                 TITULO,
                 DESCRICAO,
                 IDENTIFICADOR,
                 IMPORTANCIA,
                 CODUSU,
                 CODGRUPO,
                 TIPO,
                 DHCRIACAO,
                 CODUSUREMENTI)
    VALUES      (V_NUAVISO,
                 P_TITULO,
                 P_DESCRICAO,
                 'API',
                 P_IMPORTANCIA,
                 P_CODUSU,
                 V_CODGRUPO,
                 'P',
                 SYSDATE,
                 P_CODUSUREMETENTE);
  END;
END;
/

-- ============================================================================
-- Chamada de exemplo: alerta de férias a vencer, com IMPORTANCIA = 0 (Urgentíssimo)
-- CODGRUPO = 123 é placeholder -- ver CODGRUPO_DP no Java (pendência aberta).
-- ============================================================================
BEGIN
  STP_NOTIFICA_SISTEMA_CUSTOM(
    P_TITULO             => 'Alerta de Férias a Vencer',
    P_DESCRICAO          => 'Existem colaboradores com férias a vencer dentro do período de alerta. Consulte a lista de funcionários para mais detalhes.',
    P_CODUSU             => NULL,
    P_CODGRUPO           => 123,
    P_CODUSUREMETENTE    => -1,
    P_IMPORTANCIA        => 0
  );
END;
/
