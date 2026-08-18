# TASK 866 — Procedure `SNK_PROCIMPORTARIMAGEM_CA`: backup e atualização

Rotina de promoção que lê a tabela de importação `AD_IMPORTAIMAGEM` e leva a imagem
até a tabela que o contrato lê. Precisa passar a tratar os novos campos
`ORIGEM`, `IDVOKENEX`, `DHINTEGRACAO`.

> **Confirmado pelo fonte real (2026-08-18):**
> - **Tabela de destino** = **`AD_PLANEIMAGEM`** (colunas vistas no fonte:
>   `SEQ`, `CODIMG`, `PERFIL`, `CODPARC`, `DTCRIACAO`, `ATIVO`, `IDIMAGEMCA`, `DHALTER`).
> - **Dedup por `CODIMG`** (= `AD_IMPORTAIMAGEM.IMAGEM`), via `NOT EXISTS` (novos) /
>   `EXISTS` + detecção de mudança (alterados). **`IDVOKENEX` não é chave de dedup** —
>   é campo de procedência/rastreio.
> - **Sem `COMMIT` interno** — o chamador controla a transação.
> - Arquivos versionados:
>   - Backup do fonte anterior: [`backup/SNK_PROCIMPORTARIMAGEM_CA.20260818.sql`](backup/SNK_PROCIMPORTARIMAGEM_CA.20260818.sql)
>   - Versão atualizada: [`SNK_PROCIMPORTARIMAGEM_CA.atualizada.sql`](SNK_PROCIMPORTARIMAGEM_CA.atualizada.sql)

---

## 1. Backup da procedure (FAZER ANTES de alterar)

> ⚠️ Sempre extrair e guardar o fonte atual antes de recriar a procedure. Se algo der
> errado, o rollback é recriar a versão salva.

### Opção A — extrair o fonte via query (Sankhya / Oracle)

Rodar no "Construtor de Consultas" (aba já aberta) e exportar o resultado:

```sql
SELECT LINE, TEXT
FROM   ALL_SOURCE
WHERE  NAME = 'SNK_PROCIMPORTARIMAGEM_CA'
AND    TYPE = 'PROCEDURE'
ORDER  BY LINE;
```

Concatenando as linhas você tem o corpo integral. Alternativa (DDL completo, com o
`CREATE OR REPLACE`):

```sql
SELECT DBMS_METADATA.GET_DDL('PROCEDURE','SNK_PROCIMPORTARIMAGEM_CA') FROM DUAL;
```

Salvar a saída como arquivo versionado neste repositório:
`docs/task-866-imagem-cmdb/backup/SNK_PROCIMPORTARIMAGEM_CA.YYYYMMDD.sql`

### Opção B — backup no próprio banco (cópia de segurança rápida)

Guardar o fonte numa tabela de backup, com data:

```sql
CREATE TABLE AD_BKP_PROCEDURES (
  NOME     VARCHAR2(128),
  DHBACKUP DATE,
  FONTE    CLOB
);

INSERT INTO AD_BKP_PROCEDURES (NOME, DHBACKUP, FONTE)
SELECT 'SNK_PROCIMPORTARIMAGEM_CA',
       SYSDATE,
       DBMS_METADATA.GET_DDL('PROCEDURE','SNK_PROCIMPORTARIMAGEM_CA')
FROM   DUAL;
COMMIT;
```

> Não use rename (`ALTER ... RENAME`) como backup: o Sankhya/contrato podem referenciar
> o nome atual. Backup = **cópia** do fonte (arquivo e/ou tabela), nunca renomear o objeto vivo.

### Checklist do backup
- [ ] Fonte atual extraído (Opção A) e salvo em `backup/SNK_PROCIMPORTARIMAGEM_CA.<data>.sql`.
- [ ] (Opcional) Cópia no banco via `AD_BKP_PROCEDURES`.
- [ ] Fonte conferido: abre com `CREATE OR REPLACE PROCEDURE SNK_PROCIMPORTARIMAGEM_CA`.

---

## 2. Atualização da procedure (o que precisa mudar)

> Fonte completo em [`SNK_PROCIMPORTARIMAGEM_CA.atualizada.sql`](SNK_PROCIMPORTARIMAGEM_CA.atualizada.sql).
> Abaixo, o que muda e por quê. As linhas novas estão marcadas `-- 866` no `.sql`.

A promoção passa a **propagar os campos novos** e **carimbar a integração**, mantendo
toda a lógica original (dedup por `CODIMG`, dois cursores, sem `COMMIT` interno):

| Campo | Regra na promoção |
|---|---|
| `ORIGEM` | Propagado do staging para `AD_PLANEIMAGEM` no INSERT (C1) e no UPDATE (C2). Marca a procedência (`VOKENEX`). |
| `IDVOKENEX` | Propagado para `AD_PLANEIMAGEM` no INSERT e no UPDATE. **Rastreio/procedência — não é chave** (dedup segue por `CODIMG`). |
| `DHINTEGRACAO` | Gravado em `AD_IMPORTAIMAGEM` com `SYSDATE` após promover cada linha (marca de integrado / auditoria). |

### Mudanças pontuais (diff conceitual)

1. **C1 e C2** — acrescentar ao SELECT: `img.origem AS ORIGEM, img.idvokenex AS IDVOKENEX`.
2. **INSERT (C1)** — incluir `ORIGEM, IDVOKENEX` na lista de colunas e nos VALUES
   (`R1.ORIGEM, R1.IDVOKENEX`).
3. **UPDATE (C2)** — acrescentar `ORIGEM = R2.ORIGEM, IDVOKENEX = R2.IDVOKENEX`.
4. **Novo, nos dois loops** — após promover a linha:
   ```sql
   UPDATE AD_IMPORTAIMAGEM SET DHINTEGRACAO = SYSDATE WHERE idimagemca = R?.IDIMAGEMCA;
   ```

### Por que NÃO reescrevi como MERGE
O original já é idempotente por desenho (C1 = `NOT EXISTS`, C2 = `EXISTS` + detecção de
mudança) e a correção citada no card já está aplicada. Trocar por MERGE seria reescrever
lógica em produção sem necessidade e com risco. A alteração é **cirúrgica**: só adiciona
os campos novos e o carimbo.

### ⚠️ Pré-requisito antes de compilar
`AD_PLANEIMAGEM` precisa ter as colunas **`ORIGEM`** e **`IDVOKENEX`**. Verificar:
```sql
SELECT COLUMN_NAME FROM USER_TAB_COLUMNS
WHERE TABLE_NAME='AD_PLANEIMAGEM' AND COLUMN_NAME IN ('ORIGEM','IDVOKENEX');
```
Se **não** existirem: criar (mesma spec do staging — Texto/VARCHAR) **ou** comentar as
linhas `-- 866` do INSERT e do UPDATE. Sem isso a procedure não compila.

### Tratamento de erro / transação
Mantido como o original: **sem `COMMIT`/`EXCEPTION` internos**. Quem chama a procedure
controla a transação. Isso já atende "se falhar, não marcar como integrado": se a
promoção falhar e o chamador der rollback, o `DHINTEGRACAO` gravado no mesmo contexto
**não persiste**. Se o time quiser isolamento por linha (uma imagem com erro não derrubar
o lote), aí sim vale adicionar `BEGIN/EXCEPTION` dentro de cada loop — decisão em aberto.

### Itens confirmados / em aberto
- [x] **Corpo atual** da procedure — recebido e salvo em `backup/`.
- [x] **Tabela de destino** = `AD_PLANEIMAGEM`.
- [x] **Dedup** = por `CODIMG` (não `IDIMAGEMCA` nem `IDVOKENEX`). `IDVOKENEX` é rastreio.
- [ ] `AD_PLANEIMAGEM` tem `ORIGEM`/`IDVOKENEX`? (pré-requisito acima)
- [ ] Como a procedure é disparada (agendada / botão / rotina) — confirmar quem dá o `COMMIT`.
- [ ] Isolamento de erro por linha é desejado? (BEGIN/EXCEPTION por loop)
- [x] **`DHINTEGRACAO` = `DATE` (`Data e Hora`), gravado com `SYSDATE`.** Decisão travada:
      é carimbo interno do Sankhya (não dado espelhado como `DATACRIACAO`/epoch), e é
      consultado com lógica de data (`IS NULL` = não integrado, ranges, delta). Não seguir
      o padrão Texto/epoch da tabela de staging.
