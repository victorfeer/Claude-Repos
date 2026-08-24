# Objetos de banco — Alerta de Férias a Vencer

Índice:
1. View `VW_ALERTA_FERIAS_A_VENCER`
2. Procedure `STP_NOTIFICA_SISTEMA_CUSTOM`
3. Tabela `AD_FERIAS_NOTIFICADO`
4. Tabela `AD_FERIAS_CONFIG`
5. Troubleshooting de banco

---

## 1. View `VW_ALERTA_FERIAS_A_VENCER`

Fonte de dados da lista principal da tela HTML5 (o painel consulta `FROM VW_ALERTA_FERIAS_A_VENCER` via o serviço `DbExplorerSP.executeQuery`). Junta férias (`TFPFER`), funcionário (`TFPFUN`), departamento (`TFPDEP`), cargo (`TFPCAR`) e empresa (`TSIEMP`), aplica os filtros de elegibilidade e calcula colunas derivadas. Origem: relatório Jasper "Alerta de Férias a Vencer (V20)".

```sql
-- ============================================================================
-- VIEW:   VW_ALERTA_FERIAS_A_VENCER
-- OBJETIVO:
--   Lista funcionários cujo limite de gozo de férias está se aproximando do
--   vencimento (janela de 90 dias), para ação preventiva do RH antes de gerar
--   dobra trabalhista. É a única fonte da verdade sobre QUEM deve ser avisado.
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
    FER.DTINIAQUI,
    FER.DTFINAQUI,
    FER.DTFINAQUI + 330                                        AS LIMGOZO,
    (FER.DTFINAQUI + 330) - TRUNC(SYSDATE)                      AS DIAS_PARA_VENCER,
    FER.DTSAIDA,
    FER.NUMDIASFER,
    FER.DTSAIDA + FER.NUMDIASFER - 1                            AS RETORNO,
    COUNT(*) OVER (PARTITION BY FUN.CODFUNC)                    AS QTD_PERIODOS_NA_JANELA,
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM   TFPREQ REQ
            INNER JOIN TFPREQADM ADM ON ADM.ID = REQ.ORIGEMID
            WHERE  REQ.ORIGEMTIPO = 'V'
              AND  REQ.STATUS     = 1              -- pendente (não aprovada)
              AND  REQ.CODFUNC    = FUN.CODFUNC
        ) THEN 'N'
        ELSE 'S'
    END                                                          AS ENVIAR_SINO
FROM   TFPFER FER
INNER JOIN TFPFUN FUN ON FUN.CODEMP = FER.CODEMP AND FUN.CODFUNC = FER.CODFUNC
INNER JOIN TSIEMP EMP ON EMP.CODEMP = FUN.CODEMP
LEFT  JOIN TFPDEP DEP ON DEP.CODDEP = FUN.CODDEP
LEFT  JOIN TFPCAR CAR ON CAR.CODCARGO = FUN.CODCARGO
WHERE  EMP.CODEMP  >= 20
  AND  FUN.SITUACAO NOT IN (0, 2, 8, 9)
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
          AND  REQ.STATUS     = 2                  -- já aprovada: sai da view
          AND  REQ.CODFUNC    = FUN.CODFUNC
    );
```

### Colunas derivadas

- **`DIAS_PARA_VENCER`** — dias até o vencimento estimado (`(DTFINAQUI + 330) − hoje`); usado para ordenar e colorir por urgência no painel.
- **`LIMGOZO`** — data-limite de gozo estimada. No job Java o critério equivalente usa `DTLIMGOZFER`; **alinhar as duas definições**.
- **`RETORNO`** — data de retorno prevista (`DTSAIDA + NUMDIASFER − 1`).
- **`QTD_PERIODOS_NA_JANELA`** — quantos períodos do mesmo funcionário aparecem simultaneamente (window function).
- **`ENVIAR_SINO` ('S'/'N')** — separa o canal do sino: `'N'` quando já há requisição de férias **pendente** (`STATUS = 1`) — continua no e-mail e pop-up, mas não no sino; `'S'` caso contrário. Requisições **aprovadas** (`STATUS = 2`) saem da view pelo `NOT EXISTS` do WHERE.

### Filtros de elegibilidade (WHERE)

- `EMP.CODEMP >= 20`.
- Exclui `FUN.SITUACAO IN (0,2,8,9)` e `FUN.VINCULO IN (80,90)`.
- Exclui `FUN.DTDEM` preenchida (demitidos).
- Só períodos não gozados/quitados (`DTSAIDA IS NULL`, `DTPREVISTA IS NULL`, `NVL(ATUALFERGOZ,'N') <> 'S'`, `NUMDIASFER <> 0`).
- Janela de 90 dias sobre `DTFINAQUI + 330`.

**Sobre o 330:** `DTFINAQUI` é o fim do período aquisitivo; `+330` aproxima o fim do concessivo (~12 meses CLT). É a maior suposição do modelo — `LIMGOZO` calculado usa `ADD_MONTHS(DTFINAQUI,12) - (NUMDIASFER+10) + 1`, mais preciso. Confirmar com o RH se os 330 fixos batem com a régua real.

---

## 2. Procedure `STP_NOTIFICA_SISTEMA_CUSTOM`

Cópia customizada da procedure nativa `STP_NOTIFICA_SISTEMA`, com `P_IMPORTANCIA` exposto como parâmetro (em vez de fixo em 3) para permitir enviar o alerta como **0 (Urgentíssimo)**.

```sql
/* ============================================================================
   STP_NOTIFICA_SISTEMA_CUSTOM
   Notificação no sininho (TSIAVI) para o grupo do DP.
   Diferenças vs. a nativa STP_NOTIFICA_SISTEMA:
   - P_IMPORTANCIA exposto como parâmetro, DEFAULT 3 (compatibilidade).
   - Coluna CODUSUREMENTI (grafia REAL confirmada na TSIAVI do ambiente — a
     cópia original usava CODUSUREMETENTE, que NÃO existe).
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
    SELECT NVL(MAX(NUAVISO), 0)+1 INTO V_NUAVISO FROM TSIAVI;
    INSERT INTO TSIAVI
                (NUAVISO, TITULO, DESCRICAO, IDENTIFICADOR, IMPORTANCIA,
                 CODUSU, CODGRUPO, TIPO, DHCRIACAO, CODUSUREMENTI)
    VALUES      (V_NUAVISO, P_TITULO, P_DESCRICAO, 'API', P_IMPORTANCIA,
                 P_CODUSU, V_CODGRUPO, 'P', SYSDATE, P_CODUSUREMETENTE);
  END;
END;
```

Chamada de exemplo (alerta de férias, Urgentíssimo):

```sql
BEGIN
  STP_NOTIFICA_SISTEMA_CUSTOM(
    P_TITULO          => 'Alerta de Férias a Vencer',
    P_DESCRICAO       => 'Existem colaboradores com férias a vencer dentro do período de alerta. Consulte a lista de funcionários para mais detalhes.',
    P_CODUSU          => NULL,
    P_CODGRUPO        => 123,   -- << SUBSTITUIR pelo CODGRUPO real do DP
    P_CODUSUREMETENTE => -1,    -- -1 = "Sistema"
    P_IMPORTANCIA     => 0      -- Urgentíssimo
  );
END;
```

**Pendência:** `CODGRUPO_DP = 123` é placeholder. Confirmar antes de produção:
`SELECT CODGRUPO, DESCRGRU FROM TSIGRU WHERE DESCRGRU LIKE '%DP%'`.

**Riscos mantidos de propósito** (só os parâmetros foram ajustados): `NUAVISO` via `MAX+1` (race condition em chamadas concorrentes) e ausência de bloco `EXCEPTION`.

---

## 3. Tabela `AD_FERIAS_NOTIFICADO`

Controle de deduplicação do **sino** no modo **DIFF** (execução diária) — evita reenviar o mesmo aviso de sino para quem já foi notificado. Estrutura documentada no projeto: **uma linha por `CODEMP + CODFUNC + DTINIAQUI`** (ou equivalente), com a data de notificação. Só o canal do **sino** consulta esta tabela; o **e-mail** não usa supressão (reenvia diariamente enquanto o colaborador estiver na consulta).

---

## 4. Tabela `AD_FERIAS_CONFIG`

Modelo **chave/valor**: cada parâmetro é uma linha. Permite ajustar destinatários e modo de teste **sem recompilar o `.jar`**.

```sql
CREATE TABLE AD_FERIAS_CONFIG (
    PARAMETRO   VARCHAR2(50)  NOT NULL,
    VALOR       VARCHAR2(400),
    DESCRICAO   VARCHAR2(400),
    CONSTRAINT PK_AD_FERIAS_CONFIG PRIMARY KEY (PARAMETRO)
);

INSERT INTO AD_FERIAS_CONFIG (PARAMETRO, VALOR, DESCRICAO) VALUES
    ('MODO_TESTE', 'N', 'S = redireciona TODOS os e-mails para EMAIL_TESTE. N = envio real.');
INSERT INTO AD_FERIAS_CONFIG (PARAMETRO, VALOR, DESCRICAO) VALUES
    ('EMAIL_TESTE', 'victor.ferreira@voke.tech', 'Destino único quando MODO_TESTE = S.');
INSERT INTO AD_FERIAS_CONFIG (PARAMETRO, VALOR, DESCRICAO) VALUES
    ('DESTINATARIOS_DP', 'karina.souza@voke.tech;departamentopessoal@voke.tech;victor.ferreira@voke.tech',
     'E-mails do DP/RH (separados por ;) para o consolidado - melhoria 03.');
INSERT INTO AD_FERIAS_CONFIG (PARAMETRO, VALOR, DESCRICAO) VALUES
    ('ENVIAR_POR_LIDER', 'S', 'S = envia e-mail individual por líder (melhoria 04). N = só o consolidado do DP.');
INSERT INTO AD_FERIAS_CONFIG (PARAMETRO, VALOR, DESCRICAO) VALUES
    ('ANEXAR_CSV', 'N', 'S = anexa o CSV consolidado no e-mail do DP.');
INSERT INTO AD_FERIAS_CONFIG (PARAMETRO, VALOR, DESCRICAO) VALUES
    ('ENVIAR_QUANDO_VAZIO', 'N', 'S = envia e-mail mesmo sem alertas (confirma que rodou). N = não envia nada.');
```

**Nota histórica de rollout:** houve uma **Fase 1 (piloto/modo teste)** com `MODO_TESTE='S'` e `EMAIL_TESTE=victor.ferreira@voke.tech` — todos os e-mails (inclusive os de líderes) foram redirecionados para esse endereço único, com o assunto mostrando o destinatário real (ex.: `[TESTE → fellipe.mota@voke.tech] Sua equipe com férias a vencer`), para validar o roteamento sem contaminar a caixa dos gestores. A virada para produção foi só trocar `MODO_TESTE` para `'N'` e popular `DESTINATARIOS_DP` com os três e-mails reais — **sem recompilar**. Em versão mais antiga da classe esses parâmetros eram **constantes Java hardcoded**; a migração para `AD_FERIAS_CONFIG` é a recomendação final.

---

## 5. Troubleshooting de banco

- **Procedure "pacote vazio, sem membros públicos"** ao subir a `STP_NOTIFICA_SISTEMA_CUSTOM`: causado por um objeto remanescente do tipo **PACKAGE** com o mesmo nome no schema. Diagnóstico e correção:
  ```sql
  SELECT OBJECT_NAME, OBJECT_TYPE, STATUS FROM USER_OBJECTS
   WHERE OBJECT_NAME = 'STP_NOTIFICA_SISTEMA_CUSTOM';
  DROP PACKAGE STP_NOTIFICA_SISTEMA_CUSTOM;   -- antes do CREATE OR REPLACE PROCEDURE
  ```
- **Coluna da `TSIAVI`:** a grafia real é **`CODUSUREMENTI`** (a cópia original usava `CODUSUREMETENTE`, inexistente).
