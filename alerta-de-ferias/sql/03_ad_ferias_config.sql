-- ============================================================================
-- TABELA: AD_FERIAS_CONFIG
-- DEV:    Alerta de Ferias a Vencer
-- ----------------------------------------------------------------------------
-- OBJETIVO:
--   Parametros de e-mail no modelo chave/valor. Permite ajustar destinatarios
--   e modo de teste SEM recompilar o .jar da rotina agendada.
--
-- PROCEDENCIA: CONFIRMADO.
--
-- ESTRATEGIA DE ROLLOUT VALIDADA NO PROJETO:
--   Fase 1 (piloto): MODO_TESTE = 'S' e EMAIL_TESTE preenchido. Todos os
--   e-mails (inclusive os de lideres) sao redirecionados para o endereco
--   unico, com o assunto exibindo o destinatario real, por exemplo:
--       [TESTE -> fellipe.mota@voke.tech] Sua equipe com ferias a vencer
--   Isso valida o roteamento por lider sem contaminar a caixa dos gestores.
--
--   Virada para producao: alterar MODO_TESTE para 'N' e popular
--   DESTINATARIOS_DP. NAO exige recompilacao.
-- ============================================================================
CREATE TABLE AD_FERIAS_CONFIG (
    PARAMETRO   VARCHAR2(50)  NOT NULL,
    VALOR       VARCHAR2(400),
    DESCRICAO   VARCHAR2(400),
    CONSTRAINT PK_AD_FERIAS_CONFIG PRIMARY KEY (PARAMETRO)
);

-- ----------------------------------------------------------------------------
-- Carga inicial de parametros
-- ----------------------------------------------------------------------------
INSERT INTO AD_FERIAS_CONFIG (PARAMETRO, VALOR, DESCRICAO) VALUES
    ('MODO_TESTE', 'N', 'S = redireciona TODOS os e-mails para EMAIL_TESTE. N = envio real.');

INSERT INTO AD_FERIAS_CONFIG (PARAMETRO, VALOR, DESCRICAO) VALUES
    ('EMAIL_TESTE', 'victor.ferreira@voke.tech', 'Destino unico quando MODO_TESTE = S.');

INSERT INTO AD_FERIAS_CONFIG (PARAMETRO, VALOR, DESCRICAO) VALUES
    ('DESTINATARIOS_DP',
     'karina.souza@voke.tech;departamentopessoal@voke.tech;victor.ferreira@voke.tech',
     'E-mails do DP/RH (separados por ;) para o consolidado - melhoria 03.');

INSERT INTO AD_FERIAS_CONFIG (PARAMETRO, VALOR, DESCRICAO) VALUES
    ('ENVIAR_POR_LIDER', 'S', 'S = envia e-mail individual por lider (melhoria 04). N = so o consolidado do DP.');

INSERT INTO AD_FERIAS_CONFIG (PARAMETRO, VALOR, DESCRICAO) VALUES
    ('ANEXAR_CSV', 'N', 'S = anexa o CSV consolidado no e-mail do DP.');

INSERT INTO AD_FERIAS_CONFIG (PARAMETRO, VALOR, DESCRICAO) VALUES
    ('ENVIAR_QUANDO_VAZIO', 'N', 'S = envia e-mail mesmo sem alertas (confirma que rodou). N = nao envia nada.');

COMMIT;
