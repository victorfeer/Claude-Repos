-- ============================================================================
-- TABELA: AD_FERIAS_NOTIFICADO
-- DEV:    Alerta de Ferias a Vencer
-- ----------------------------------------------------------------------------
-- OBJETIVO:
--   Controle de deduplicacao do SININHO no modo DIFF (execucao diaria).
--   Evita reenviar o mesmo aviso de sino para quem ja foi notificado.
--
--   Somente o canal do SINO consulta esta tabela. O canal de E-MAIL nao usa
--   supressao: reenvia diariamente enquanto o colaborador estiver na consulta.
--
-- PROCEDENCIA: DDL conforme a sugestao registrada ao final do arquivo
-- AlertaFeriasNotificacao.java do projeto. A chave do periodo e a
-- SEQUENCIA de TFPFER (nao a DTINIAQUI).
--
-- ATENCAO - NAO ativar a Acao Agendada em modo DIFF em producao sem esta
-- tabela: sem ela o mesmo alerta de sino DUPLICA todos os dias.
--
-- DEPENDENCIA: a view VW_ALERTA_FERIAS_A_VENCER precisa EXPOR a coluna
-- SEQUENCIA para que a rotina consiga popular esta tabela. Isso foi
-- corrigido no script 01 desta mesma pasta.

CREATE TABLE AD_FERIAS_NOTIFICADO (
    CODEMP        NUMBER(3)      NOT NULL,
    CODFUNC       NUMBER(10)     NOT NULL,
    SEQUENCIA     NUMBER(3)      NOT NULL,  -- periodo de ferias (TFPFER.SEQUENCIA)
    DTNOTIFICACAO DATE           DEFAULT SYSDATE NOT NULL,
    CONSTRAINT PK_AD_FERIAS_NOTIFICADO PRIMARY KEY (CODEMP, CODFUNC, SEQUENCIA)
);

-- Consulta de apoio - conferir a estrutura REAL no ambiente antes de aplicar:
--   SELECT COLUMN_NAME, DATA_TYPE, DATA_LENGTH, NULLABLE
--     FROM USER_TAB_COLUMNS
--    WHERE TABLE_NAME = 'AD_FERIAS_NOTIFICADO'
--    ORDER BY COLUMN_ID;
