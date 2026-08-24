# Runbook de Produção — Alerta de Férias a Vencer

> **Base:** artefato real de homologação `alertaferias.jar` (projeto Eclipse
> `AlertaFeriasHml`, classes de **10/07/2026**), decompilado e conferido.
> Tudo abaixo reflete o que está efetivamente implantado, não a documentação
> anterior à análise do artefato.

---

## 1. Resumo — o que precisa acontecer

| # | Ação | Tipo | Bloqueia? |
|---|---|---|---|
| 1 | Trocar `MODO_TESTE` para `false` e **recompilar** o jar | Alteração de código | **SIM** |
| 2 | Mapear os 8 `CODUSU` do sininho para os códigos de **produção** | Alteração de código | **SIM** |
| 3 | Confirmar `CODCON`/`CODSMTP` válidos em produção | Alteração de código | **SIM** |
| 4 | Confirmar `EMAIL_DESTINATARIOS_DP` | Alteração de código | **SIM** |
| 5 | Criar `AD_FERIAS_NOTIFICADO` | Objeto de banco | **SIM** |
| 6 | Criar/atualizar `STP_NOTIFICA_SISTEMA_CUSTOM` (5 parâmetros) | Objeto de banco | **SIM** |
| 7 | Garantir `AD_LIDER` e `AD_EMAILLIDER` na `TFPFUN`, preenchidos | Campo customizado | **SIM** |
| 8 | Publicar o `.jar` e cadastrar a Ação Agendada | Deploy | **SIM** |
| 9 | Conceder **Autorização de Customização** | Configuração | **SIM** |
| 10 | Criar `VW_ALERTA_FERIAS_A_VENCER` | Objeto de banco | Só para o painel |
| 11 | Publicar a tela HTML5 (painel) | Deploy | Só para o painel |
| 12 | Criar `AD_FERIAS_CONFIG` | Objeto de banco | **Não — ver §6** |

---

## 2. Bloqueadores — resolver ANTES da janela

### 2.1. `MODO_TESTE` está ligado no artefato

```java
private static final boolean MODO_TESTE = true;   // <-- no jar de HML
```

`MODO_TESTE` é **constante de tempo de compilação**. O compilador **elimina o
ramo de produção** do bytecode: o redirecionamento para o endereço de teste é
**incondicional**.

> **Consequência:** subir este jar em produção faz **todo** e-mail ir para
> `victor.ferreira@voke.tech`. Nem o DP nem os líderes recebem nada. Nenhuma
> configuração, parâmetro ou dado altera isso.

**Ação:** alterar para `false` e **recompilar**. Não existe atalho.

### 2.2. Os `CODUSU` do sininho são de homologação

```java
private static final int[] CODUSU_DESTINATARIOS =
        new int[] { 1716, 1945, 1946, 1947, 2365, 3379, 3387, 3388 };
```

São códigos de usuário do **ambiente de homologação**. Códigos de usuário
**não são iguais entre HML e produção**.

**Ação:** identificar quem são essas pessoas em HML e obter o `CODUSU`
equivalente em produção.

```sql
-- Em HOMOLOGAÇÃO — descobrir QUEM são:
SELECT CODUSU, NOMEUSU, EMAIL FROM TSIUSU
 WHERE CODUSU IN (1716,1945,1946,1947,2365,3379,3387,3388)
 ORDER BY CODUSU;

-- Em PRODUÇÃO — obter os códigos correspondentes:
SELECT CODUSU, NOMEUSU, EMAIL FROM TSIUSU
 WHERE UPPER(NOMEUSU) IN ('NOME 1','NOME 2', ...)
 ORDER BY NOMEUSU;
```

> **Risco se ignorado:** aviso gravado para usuário errado (ou inexistente) —
> **sem gerar erro**. A rotina roda "com sucesso" e ninguém é avisado.

### 2.3. Conta e servidor de e-mail

```java
private static final int CODCON_EMAIL  = 0;
private static final int CODSMTP_EMAIL = 11;
```

Também são do ambiente de homologação.

```sql
-- Em PRODUÇÃO, espelhar um e-mail que JÁ saiu com sucesso:
SELECT CODFILA, STATUS, CODCON, CODSMTP, EMAIL, ASSUNTO, DTENTRADA
  FROM TMDFMG
 WHERE STATUS = 'Sucesso: Enviada'
 ORDER BY CODFILA DESC
 FETCH FIRST 20 ROWS ONLY;
```

> A tabela de contas `TSICON` **não existe** neste ambiente (ORA-00942).
> Espelhar a `TMDFMG` é o caminho confiável.

### 2.4. Destinatários do consolidado

```java
private static final String EMAIL_DESTINATARIOS_DP =
    "karina.souza@voke.tech;departamentopessoal@voke.tech;victor.ferreira@voke.tech";
```

Confirmar com o DP se a lista de produção é essa. Note que inclui um endereço
pessoal de desenvolvimento — avaliar se deve permanecer.

---

## 3. Objetos de banco a subir

Ordem de aplicação. Scripts em [`../sql/`](../sql).

| Ordem | Script | Objeto | Necessário para |
|---|---|---|---|
| 1 | `04_ad_ferias_notificado.sql` | `AD_FERIAS_NOTIFICADO` | **Rotina** (obrigatório) |
| 2 | `02_stp_notifica_sistema_custom.sql` | `STP_NOTIFICA_SISTEMA_CUSTOM` | **Rotina** (obrigatório) |
| 3 | `01_vw_alerta_ferias_a_vencer.sql` | `VW_ALERTA_FERIAS_A_VENCER` | Painel HTML5 |
| 4 | `03_ad_ferias_config.sql` | `AD_FERIAS_CONFIG` | **Nada hoje — ver §6** |

### 3.1. `AD_FERIAS_NOTIFICADO` — chave por `SEQUENCIA`

```sql
CREATE TABLE AD_FERIAS_NOTIFICADO (
    CODEMP        NUMBER(3)   NOT NULL,
    CODFUNC       NUMBER(10)  NOT NULL,
    SEQUENCIA     NUMBER(3)   NOT NULL,   -- TFPFER.SEQUENCIA
    DTNOTIFICACAO DATE        DEFAULT SYSDATE NOT NULL,
    CONSTRAINT PK_AD_FERIAS_NOTIFICADO PRIMARY KEY (CODEMP, CODFUNC, SEQUENCIA)
);
```

> **Sem esta tabela a rotina falha** no modo `DIFF` (todo dia exceto o último
> dia útil do mês), porque consulta e grava nela sem tratamento de "tabela
> inexistente".

### 3.2. `STP_NOTIFICA_SISTEMA_CUSTOM` — **5 parâmetros**

A rotina chama assim:

```java
"{call STP_NOTIFICA_SISTEMA_CUSTOM(?, ?, ?, ?, ?)}"
// (titulo, descricao, CODUSU destino, -1 remetente, 0 importancia)
```

> **Atenção:** documentação anterior descrevia **6 parâmetros**, com
> `P_CODGRUPO`. Criar a procedure daquela forma faz a chamada da rotina
> **falhar** (número de argumentos inválido). Use o script corrigido.

Se o ambiente já tiver uma versão com 6 parâmetros, **derrubar antes**:

```sql
SELECT OBJECT_NAME, OBJECT_TYPE, STATUS FROM USER_OBJECTS
 WHERE OBJECT_NAME = 'STP_NOTIFICA_SISTEMA_CUSTOM';

-- Conferir a assinatura atual:
SELECT ARGUMENT_NAME, POSITION, DATA_TYPE
  FROM USER_ARGUMENTS
 WHERE OBJECT_NAME = 'STP_NOTIFICA_SISTEMA_CUSTOM'
 ORDER BY POSITION;

DROP PROCEDURE STP_NOTIFICA_SISTEMA_CUSTOM;   -- se a assinatura divergir
```

### 3.3. Campos customizados na `TFPFUN` — pré-requisito

A rotina lê `FUN.AD_LIDER` e `FUN.AD_EMAILLIDER`. São **campos customizados**.

```sql
-- Existem em produção?
SELECT COLUMN_NAME, DATA_TYPE, DATA_LENGTH
  FROM USER_TAB_COLUMNS
 WHERE TABLE_NAME = 'TFPFUN'
   AND COLUMN_NAME IN ('AD_LIDER','AD_EMAILLIDER');

-- Quantos funcionários ativos estão SEM e-mail de líder?
SELECT COUNT(*) FROM TFPFUN
 WHERE DTDEM IS NULL
   AND (AD_EMAILLIDER IS NULL OR TRIM(AD_EMAILLIDER) IS NULL);
```

> Sem `AD_EMAILLIDER` preenchido, o colaborador **some do e-mail por líder**
> silenciosamente (continua no consolidado do DP). A rotina **não avisa** sobre
> líderes sem e-mail.

---

## 4. Passo a passo da implantação

| # | Etapa | Comando / Ação | Responsável |
|---|---|---|---|
| 1 | Backup | Extrair DDL atual de `STP_NOTIFICA_SISTEMA_CUSTOM` e da view, se existirem | DBA |
| 2 | Conferir pré-requisitos | `AD_LIDER`/`AD_EMAILLIDER` na `TFPFUN` (§3.3) | DBA |
| 3 | Criar tabela de deduplicação | `04_ad_ferias_notificado.sql` | DBA |
| 4 | Criar/atualizar procedure | `02_stp_notifica_sistema_custom.sql` (5 params) | DBA |
| 5 | Criar view (painel) | `01_vw_alerta_ferias_a_vencer.sql` | DBA |
| 6 | Ajustar constantes no código | `MODO_TESTE=false`, `CODUSU_DESTINATARIOS`, `CODCON`, `CODSMTP`, destinatários | Desenvolvedor |
| 7 | Compilar | `mvn clean package` — **UTF-8** | Desenvolvedor |
| 8 | Publicar o `.jar` | Procedimento padrão do ambiente | Consultor Sankhya |
| 9 | Cadastrar Ação Agendada | Java, classe `br.com.voke.rh.ferias.AlertaFeriasNotificacao`, **CRON diário** | Consultor Sankhya |
| 10 | **Autorização de Customização** | Obrigatória na 1ª ativação **e após cada alteração de classe** | Administrador |
| 11 | Publicar o painel HTML5 | Importar o componente | Consultor Sankhya |
| 12 | Execução assistida | Disparo manual + validações da §5 | Consultor + DP |
| 13 | Monitorar 1º ciclo automático | Acompanhar log e `TMDFMG` | Consultor + DP |

> **Etapa 10 é a causa mais comum de "a rotina não rodou".** Sem a autorização,
> a Ação Agendada fica cadastrada e aparentemente ativa, mas **nunca dispara** —
> e não gera mensagem de erro.

### Sobre a compilação (etapa 7)

```bash
cd ferias
mvn clean package     # gera target/api-sankhya-ferias.jar
```

Java 8, UTF-8 — ambos já fixados no `pom.xml`. Compilar fora de UTF-8 corrompe
a acentuação dos e-mails e dos avisos.

---

## 5. Validação pós-implantação

| # | Verificação | Como | Esperado |
|---|---|---|---|
| 1 | A rotina executou | Log da Ação Agendada | Linhas `[AlertaFerias] === Iniciando modo=... ===` e `=== Concluído ===` |
| 2 | Quantidade detectada | Log | `Na janela (criterio A ou B): N` com N plausível |
| 3 | E-mails enfileirados | `SELECT * FROM TMDFMG ORDER BY CODFILA DESC` | Registros com `STATUS='Pendente'` |
| 4 | E-mails enviados | Mesma consulta, minutos depois | `STATUS='Sucesso: Enviada'` |
| 5 | **Sem prefixo `[TESTE ->`** | Assunto na `TMDFMG` | Assunto limpo. **Se aparecer `[TESTE ->`, o jar publicado ainda está em modo teste** |
| 6 | Destinatário correto | Coluna `EMAIL` da `TMDFMG` | E-mails reais do DP e dos líderes |
| 7 | Sininho gravado | `SELECT * FROM TSIAVI ORDER BY NUAVISO DESC` | Avisos com `IMPORTANCIA=0` e `CODUSU` dos destinatários de produção |
| 8 | Deduplicação | Reexecutar no mesmo dia | `Novos (DIFF): 0` e nenhum aviso novo |
| 9 | Registro da dedup | `SELECT COUNT(*) FROM AD_FERIAS_NOTIFICADO` | Igual ao total de sinos enviados |
| 10 | Acentuação | Corpo do e-mail e texto do aviso | "Férias", "período", "atenção" corretos |
| 11 | Painel | Abrir a tela | Filtros, KPIs, accordion e CSV operando |
| 12 | Drill-through | Botão "Abrir requisição de férias" | Abre Requisições na mesma sessão |

### Consulta única de conferência

```sql
SELECT CODFILA, STATUS, CODCON, CODSMTP, EMAIL, ASSUNTO, DTENTRADA
  FROM TMDFMG
 WHERE DTENTRADA >= TRUNC(SYSDATE)
 ORDER BY CODFILA DESC;
```

---

## 6. `AD_FERIAS_CONFIG` — não é usada pelo artefato

A documentação anterior descrevia essa tabela como fonte dos parâmetros de
e-mail, "sem precisar recompilar". **O jar implantado não a consulta** —
verificado: zero referências no bytecode. Toda a configuração está em
constantes Java.

**Implicações:**

- Criar a tabela **não muda comportamento nenhum** hoje.
- Qualquer troca de destinatário, de conta SMTP ou do modo de teste **exige
  alterar o código e recompilar**.
- Manter a tabela criada só faz sentido como preparação para a melhoria de
  externalizar a configuração (recomendada, mas **não implementada**).

> **Decisão a tomar:** criar a tabela agora (preparando a melhoria) ou deixar
> para quando a melhoria for feita. Não há impacto operacional em nenhuma das
> opções.

---

## 7. Divergência view × rotina — decidir antes de prometer o painel

O painel (view) e a rotina (e-mail/sino) **não aplicam a mesma regra**. Ver
[`divergencia-view-x-job.md`](divergencia-view-x-job.md) para a tabela completa.
Os pontos que o DP vai perceber:

| | Painel (view) | E-mail/sino (rotina) |
|---|---|---|
| Data de vencimento | `DTFINAQUI + 330` | `DTLIMGOZFER` |
| Janela | 90 dias | 30 dias |
| Empresas | só `CODEMP >= 20` | todas |

> **Consequência:** o DP pode receber e-mail sobre alguém que **não aparece** no
> painel, e ver no painel uma data de vencimento **diferente** da do e-mail.

**Recomendação:** alinhar a view à regra da rotina (que é a validada) **antes**
de divulgar o painel ao DP, ou comunicar explicitamente que são recortes
diferentes.

---

## 8. Rollback

### Contenção imediata (minutos, sem alterar dados)

**Desativar a Ação Agendada** na tela de Ações Agendadas. Interrompe todos os
disparos. É a primeira medida em qualquer incidente.

### Rollback completo

Nesta ordem:

```sql
-- 1) Desativar e excluir a Ação Agendada  (tela do Sankhya)
-- 2) Remover o .jar                        (procedimento do ambiente)
-- 3) Despublicar a tela HTML5              (tela do Sankhya)
-- 4) Objetos de banco:
DROP PROCEDURE STP_NOTIFICA_SISTEMA_CUSTOM;
DROP VIEW VW_ALERTA_FERIAS_A_VENCER;
DROP TABLE AD_FERIAS_NOTIFICADO;
DROP TABLE AD_FERIAS_CONFIG;   -- se tiver sido criada
```

> **Ordem importa:** remover a Ação Agendada e o `.jar` **antes** dos objetos de
> banco. A ordem inversa faz a rotina falhar em execução por objeto inexistente.

**Impacto:** nenhum objeto **nativo** do Sankhya é alterado — a procedure é uma
**cópia** (`_CUSTOM`), e a nativa `STP_NOTIFICA_SISTEMA` permanece intacta.
Registros já gravados em `TSIAVI` e `TMDFMG` **permanecem** como histórico e não
exigem expurgo.

---

## 9. Riscos residuais após a implantação

| Risco | Impacto | Mitigação |
|---|---|---|
| Último dia útil **não considera feriados** | Em mês encerrado em feriado, o modo `COMPLETO` não roda | Aceitar, ou evoluir com calendário de feriados |
| `NUAVISO` via `MAX+1`, chamado **8× por colaborador** | Colisão em concorrência | Herdado da procedure nativa; monitorar |
| Configuração hardcoded | Toda mudança exige recompilar | Externalizar para `AD_FERIAS_CONFIG` (melhoria) |
| Líder sem e-mail é ignorado em silêncio | Colaborador não chega ao gestor | Monitorar a consulta da §3.3 |
| `ANEXAR_CSV = false` | CSV existe no código mas nunca é anexado | Nenhuma — comportamento intencional |
| View e rotina divergentes | Painel e e-mail discordam | §7 |
