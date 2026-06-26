-- ============================================================================
-- AD_FERIAS_NOTIFICADO
-- Tabela auxiliar de controle do modo DIFF.
--
-- OBRIGATÓRIA antes de ativar a Ação Agendada diária (modo DIFF).
-- Sem ela, o mesmo alerta é gerado todos os dias para o mesmo colaborador.
--
-- A PK (CODEMP, CODFUNC, SEQUENCIA) garante idempotência: se a rotina
-- for disparada duas vezes no mesmo dia por erro operacional, o segundo
-- INSERT é ignorado pelo WHERE NOT EXISTS no Java, sem erro nem duplicata.
--
-- SEQUENCIA refere-se a TFPFER.SEQUENCIA -- identifica o período de férias
-- dentro do histórico do funcionário. Um mesmo funcionário pode ter mais
-- de um período na janela; a deduplicação no Java mantém só o mais urgente
-- antes de checar esta tabela, então na prática cada (CODEMP, CODFUNC)
-- aparecerá com uma única SEQUENCIA por execução DIFF.
--
-- Não há processo automático de limpeza desta tabela. Registros antigos
-- (funcionários cujas férias já foram gozadas) ficam acumulando.
-- Isso não causa problema funcional -- a view VW_ALERTA_FERIAS_A_VENCER
-- já filtra só quem está na janela ativa. Mas recomenda-se uma purge
-- periódica manual ou job de limpeza no futuro.
-- ============================================================================

CREATE TABLE AD_FERIAS_NOTIFICADO (
    CODEMP        NUMBER(3)   NOT NULL,
    CODFUNC       NUMBER(10)  NOT NULL,
    SEQUENCIA     NUMBER(3)   NOT NULL,
    DTNOTIFICACAO DATE        DEFAULT SYSDATE NOT NULL,
    CONSTRAINT PK_AD_FERIAS_NOTIFICADO PRIMARY KEY (CODEMP, CODFUNC, SEQUENCIA)
);
