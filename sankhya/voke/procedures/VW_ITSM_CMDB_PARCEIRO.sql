-- ============================================================================
-- VW_ITSM_CMDB_PARCEIRO
--
-- View de origem dos parceiros (empresas/clientes) espelhados no CMDB do
-- VokeNext / Run2Biz. Projeta TGFPAR no contrato de colunas que o voke.jar
-- espera.
--
-- Consumidores (modulo 52 - Integracao Run2Biz BHZ):
--   * voke.eventos.EventoEmpresaCMDB      -> evento de persistencia em TGFPAR
--       -> EmpresaController.verificarEmpresa()
--          -> sql/consultaEmpresa.sql     : WHERE IDENTIFICADOR = :CODPARC
--   * voke.schedule.ScheduleChecarEmpresaCMDB (acao agendada 173, 20 min)
--       -> EmpresaController.buscarEmpresasDia()
--          -> sql/consultaEmpresaDia.sql  : WHERE ATUALIZADO_EM >= SYSDATE - (10/1440)
--
-- IMPORTANTE: o evento em TGFPAR e SINCRONO e o EmpresaController relanca a
-- excecao (throw new RuntimeException). Se esta view nao existir, o cadastro
-- de parceiro no ERP e ABORTADO com "ORA-00942: a tabela ou view nao existe".
-- Foi exatamente o incidente que originou este script.
--
-- Contrato de colunas exigido pelo Java (EmpresaController.buscarDadosEmpresa,
-- leitura por NOME, entao a ordem nao importa - a AUSENCIA de qualquer uma
-- quebra a integracao):
--   IDENTIFICADOR, NOME, NOME_COMPLETO, CNPJ, CPF, INSC_ESTADUAL,
--   GERENTE_REGIONAL, GERENTE_OPERACIONAL, AREA, REGIONAL, ID_LOJA, TIPO,
--   CLASSE, RUA, PAIS_ESTADO_CIDADE, CEP, CRIADO_POR, ATUALIZADO_POR,
--   DS_ORIGEM, CRIADO_EM, ATUALIZADO_EM, ERP_ID_CLIENTE, ID_ORGANIZACAO
--
-- Sem FORCE de proposito: se alguma coluna de origem nao existir no ambiente,
-- e melhor o CREATE falhar na hora (ORA-00904, visivel no deploy) do que criar
-- uma view INVALID que so vai estourar depois, em runtime, no cadastro de
-- parceiro (ORA-04063).
--
-- PRE-REQUISITO - rodar ANTES e conferir que retorna 1 linha:
--   SELECT COLUMN_NAME FROM ALL_TAB_COLUMNS
--    WHERE TABLE_NAME = 'TGFPAR' AND COLUMN_NAME = 'AD_DHALTERPARCEIRO';
--   Se retornar vazio, o campo customizado nao existe neste banco: cadastre-o
--   pelo dicionario ou troque o NVL abaixo por apenas PAR.DTALTER.
--
-- Idempotente: CREATE OR REPLACE.
-- ============================================================================
CREATE OR REPLACE VIEW VW_ITSM_CMDB_PARCEIRO AS
SELECT
    PAR.NOMEPARC                          AS NOME,
    CASE
        WHEN LENGTH(REGEXP_REPLACE(PAR.CGC_CPF, '[^0-9A-Za-z]', '')) = 14
            THEN PAR.CGC_CPF
    END                                   AS CNPJ,
    CASE
        WHEN LENGTH(REGEXP_REPLACE(PAR.CGC_CPF, '[^0-9]', '')) = 11
            THEN PAR.CGC_CPF
    END                                   AS CPF,
    PAR.IDENTINSCESTAD                    AS INSC_ESTADUAL,
    CAST(NULL AS VARCHAR2(100))           AS GERENTE_REGIONAL,
    CAST(NULL AS VARCHAR2(100))           AS GERENTE_OPERACIONAL,
    CAST(NULL AS VARCHAR2(100))           AS AREA,
    CAST(NULL AS VARCHAR2(100))           AS REGIONAL,
    CAST(NULL AS VARCHAR2(100))           AS ID_LOJA,
    CASE
        WHEN PAR.TIPPESSOA = 'J' THEN 'EMPRESA'
        ELSE PAR.TIPPESSOA
    END                                   AS TIPO,
    CASE
        WHEN PAR.CLIENTE = 'S' THEN 'CLIENTE'
        ELSE PAR.CLIENTE
    END                                   AS CLASSE,
    PAR.RAZAOSOCIAL                       AS NOME_COMPLETO,
    NVL(EN.CODLOGRADOURO, '') || ' ' ||
    NVL(EN.NOMEEND, '')      || ' ' ||
    NVL(PAR.NUMEND, '')      || ' ' ||
    NVL(PAR.COMPLEMENTO, ' ')             AS RUA,
    NVL(CID.NOMECID, '')     || '/' ||
    NVL(UF.UF, '')           || '/' ||
    NVL(PAIS.ABREVIATURA, '')             AS PAIS_ESTADO_CIDADE,
    PAR.CEP                               AS CEP,
    NVL(PAR.DTALTER, PAR.AD_DHALTERPARCEIRO) AS ATUALIZADO_EM,
    CAST(NULL AS VARCHAR2(100))           AS ATUALIZADO_POR,
    PAR.DTCAD                             AS CRIADO_EM,
    CAST(NULL AS VARCHAR2(100))           AS CRIADO_POR,
    PAR.CODPARC                           AS ERP_ID_CLIENTE,
    PAR.CODPARC                           AS ID_ORGANIZACAO,
    PAR.CODPARC                           AS IDENTIFICADOR,
    'SANKHYA'                             AS DS_ORIGEM
FROM
    TGFPAR PAR
LEFT JOIN
    TSIEND EN
        ON PAR.CODEND = EN.CODEND
LEFT JOIN
    TSICID CID
        ON PAR.CODCID = CID.CODCID
LEFT JOIN
    TSIUFS UF
        ON CID.UF = UF.CODUF
LEFT JOIN
    TSIPAI PAIS
        ON PAIS.CODPAIS = UF.CODPAIS
;

-- ============================================================================
-- VERIFICACAO POS-DEPLOY (rodar as tres)
-- ============================================================================
-- 1) A view existe e esta VALID:
-- SELECT owner, object_name, status FROM all_objects
--  WHERE object_name = 'VW_ITSM_CMDB_PARCEIRO';
--
-- 2) Reproduz o caminho do evento (troque pelo CODPARC do parceiro que falhou):
-- SELECT * FROM VW_ITSM_CMDB_PARCEIRO WHERE IDENTIFICADOR = :CODPARC;
--
-- 3) Reproduz o caminho da acao agendada 173:
-- SELECT COUNT(*) FROM VW_ITSM_CMDB_PARCEIRO
--  WHERE ATUALIZADO_EM >= SYSDATE - (10/1440) AND ATUALIZADO_EM <= SYSDATE;
--
-- Se o usuario que roda este script NAO for o mesmo com que o Sankhya conecta
-- (confira com SELECT USER FROM DUAL pelo SQL do proprio Sankhya), ainda faltam:
-- GRANT SELECT ON <OWNER>.VW_ITSM_CMDB_PARCEIRO TO <USUARIO_SANKHYA>;
-- CREATE OR REPLACE SYNONYM <USUARIO_SANKHYA>.VW_ITSM_CMDB_PARCEIRO
--     FOR <OWNER>.VW_ITSM_CMDB_PARCEIRO;
-- ============================================================================
