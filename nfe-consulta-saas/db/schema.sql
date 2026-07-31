-- ============================================================================
-- Consulta NF-e SaaS · Modelo relacional (PostgreSQL 15+)
-- Multiempresa (multi-tenant por coluna empresa_id) · LGPD · Auditoria
-- ============================================================================
-- Estratégia multi-tenant: "shared database, shared schema" com discriminador
-- empresa_id em todas as tabelas de negócio + Row Level Security (RLS) para
-- isolamento forte. Escala bem para SaaS e simplifica backups/manutenção.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- EMPRESAS (tenants)
-- ---------------------------------------------------------------------------
CREATE TABLE empresa (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    razao_social    VARCHAR(200) NOT NULL,
    cnpj            VARCHAR(14)  NOT NULL UNIQUE,
    plano           VARCHAR(30)  NOT NULL DEFAULT 'TRIAL',   -- TRIAL|BASICO|PRO|ENTERPRISE
    ativo           BOOLEAN      NOT NULL DEFAULT TRUE,
    -- Config de integração Sankhya (segredos cifrados na aplicação, ver observação)
    sankhya_base_url    VARCHAR(255),
    sankhya_client_id   VARCHAR(255),
    sankhya_secret_enc  TEXT,        -- cifrado (AES-GCM) na camada de aplicação
    sankhya_xtoken_enc  TEXT,        -- cifrado
    criado_em       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- USUÁRIOS
-- ---------------------------------------------------------------------------
CREATE TABLE perfil (
    id      SMALLINT PRIMARY KEY,
    nome    VARCHAR(30) NOT NULL UNIQUE      -- ADMIN | OPERADOR | CONSULTA | AUDITOR
);
INSERT INTO perfil (id, nome) VALUES
    (1,'ADMIN'), (2,'OPERADOR'), (3,'CONSULTA'), (4,'AUDITOR');

CREATE TABLE usuario (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id      UUID NOT NULL REFERENCES empresa(id),
    nome            VARCHAR(150) NOT NULL,
    email           VARCHAR(180) NOT NULL,
    senha_hash      VARCHAR(100) NOT NULL,           -- BCrypt/Argon2 (nunca texto puro)
    perfil_id       SMALLINT NOT NULL REFERENCES perfil(id),
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    mfa_secret_enc  TEXT,                            -- opcional (TOTP), cifrado
    ultimo_login    TIMESTAMPTZ,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_usuario_email UNIQUE (empresa_id, email)
);
CREATE INDEX idx_usuario_empresa ON usuario(empresa_id);

-- ---------------------------------------------------------------------------
-- NOTAS FISCAIS (cache / repositório próprio)
-- ---------------------------------------------------------------------------
CREATE TABLE nota_fiscal (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id      UUID NOT NULL REFERENCES empresa(id),
    chave_acesso    CHAR(44) NOT NULL,
    numero          VARCHAR(15),
    serie           VARCHAR(5),
    emissao         TIMESTAMPTZ,
    natureza        VARCHAR(200),
    status          VARCHAR(20),         -- AUTORIZADA|CANCELADA|DENEGADA
    protocolo       VARCHAR(30),
    dh_protocolo    TIMESTAMPTZ,
    emit_nome       VARCHAR(200),
    emit_cnpj       VARCHAR(14),
    dest_nome       VARCHAR(200),
    dest_cnpj       VARCHAR(14),
    valor_total     NUMERIC(15,2),
    total_produtos  NUMERIC(15,2),
    total_impostos  NUMERIC(15,2),
    origem          VARCHAR(20) NOT NULL DEFAULT 'SANKHYA',  -- SANKHYA|SEFAZ|UPLOAD
    dados_json      JSONB,               -- payload normalizado (produtos, impostos)
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_nota_chave UNIQUE (empresa_id, chave_acesso)
);
CREATE INDEX idx_nota_empresa_chave ON nota_fiscal(empresa_id, chave_acesso);
CREATE INDEX idx_nota_emissao ON nota_fiscal(empresa_id, emissao);

-- ---------------------------------------------------------------------------
-- XMLs ARMAZENADOS (separado da nota para não inflar as consultas)
-- ---------------------------------------------------------------------------
CREATE TABLE nota_xml (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nota_id         UUID NOT NULL UNIQUE REFERENCES nota_fiscal(id) ON DELETE CASCADE,
    empresa_id      UUID NOT NULL REFERENCES empresa(id),
    xml_conteudo    TEXT NOT NULL,       -- ou ponteiro para object storage (S3) em alto volume
    hash_sha256     CHAR(64) NOT NULL,   -- integridade
    tamanho_bytes   INTEGER,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- CONSULTAS REALIZADAS (histórico funcional)
-- ---------------------------------------------------------------------------
CREATE TABLE consulta (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id      UUID NOT NULL REFERENCES empresa(id),
    usuario_id      UUID REFERENCES usuario(id),
    chave_acesso    CHAR(44) NOT NULL,
    resultado       VARCHAR(20) NOT NULL,   -- ENCONTRADA|NAO_ENCONTRADA|ERRO
    fonte           VARCHAR(20),            -- CACHE|SANKHYA_API|SANKHYA_DB|SEFAZ
    gerou_pdf       BOOLEAN NOT NULL DEFAULT FALSE,
    duracao_ms      INTEGER,
    ip_origem       INET,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_consulta_empresa_data ON consulta(empresa_id, criado_em);
CREATE INDEX idx_consulta_usuario ON consulta(usuario_id);

-- ---------------------------------------------------------------------------
-- LOGS DE AUDITORIA (imutável; append-only)
-- ---------------------------------------------------------------------------
CREATE TABLE log_auditoria (
    id              BIGSERIAL PRIMARY KEY,
    empresa_id      UUID,
    usuario_id      UUID,
    acao            VARCHAR(60) NOT NULL,   -- LOGIN|CONSULTA_NFE|GERAR_PDF|CRUD_USUARIO...
    entidade        VARCHAR(60),
    entidade_id     VARCHAR(60),
    detalhe_json    JSONB,
    ip_origem       INET,
    user_agent      VARCHAR(300),
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_log_empresa_data ON log_auditoria(empresa_id, criado_em);
CREATE INDEX idx_log_acao ON log_auditoria(acao);

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY (isolamento multiempresa reforçado)
-- A aplicação seta:  SET app.empresa_id = '<uuid do tenant do JWT>';
-- ---------------------------------------------------------------------------
ALTER TABLE nota_fiscal ENABLE ROW LEVEL SECURITY;
ALTER TABLE nota_xml    ENABLE ROW LEVEL SECURITY;
ALTER TABLE consulta    ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario     ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_nota  ON nota_fiscal USING (empresa_id = current_setting('app.empresa_id')::uuid);
CREATE POLICY p_xml   ON nota_xml    USING (empresa_id = current_setting('app.empresa_id')::uuid);
CREATE POLICY p_cons  ON consulta    USING (empresa_id = current_setting('app.empresa_id')::uuid);
CREATE POLICY p_user  ON usuario     USING (empresa_id = current_setting('app.empresa_id')::uuid);

-- ============================================================================
-- Observações:
--  * Segredos Sankhya: guardados cifrados (AES-GCM) e decifrados só em memória.
--    Em produção, preferir um secrets manager (AWS Secrets Manager / Vault).
--  * LGPD: CNPJ/razão de terceiros são dados de PJ; ainda assim aplique
--    minimização, retenção configurável e purga automática de XML/consulta.
--  * Retenção: job agendado remove consulta/log_auditoria além do período
--    contratado por plano (ex.: 12 meses), preservando trilha legal mínima.
-- ============================================================================
