# TASK 866 — Procedure `SNK_PROCIMPORTARIMAGEM_CA`: backup e atualização

Rotina de promoção que lê a tabela de importação `AD_IMPORTAIMAGEM` e leva a imagem
até a tabela que o contrato lê. Precisa passar a tratar os novos campos
`ORIGEM`, `IDVOKENEX`, `DHINTEGRACAO`.

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

> **Pendência:** template abaixo. Para o diff exato, colar aqui o **corpo atual** da
> procedure (saída do backup Opção A). Os trechos `⟨...⟩` dependem do fonte real.

A promoção precisa **carregar/propagar os três campos novos** ao levar o registro de
`AD_IMPORTAIMAGEM` para ⟨tabela de destino que o contrato lê⟩:

| Campo | Regra na promoção |
|---|---|
| `ORIGEM` | Propagar `ORIGEM` do registro (para `VOKENEX`, marca a procedência). |
| `IDVOKENEX` | Propagar o id estável do VokeNext; usado como **chave de deduplicação** (não duplicar). |
| `DHINTEGRACAO` | Gravar `SYSDATE` **no sucesso** da promoção. Nulo = ainda não integrado (permite reenvio). |

### Padrão recomendado — MERGE idempotente

Deduplicação depende da decisão A/B (ver spec dos campos):
- **Hipótese A** (VokeNext manda o mesmo GUID de `IDIMAGEMCA`): casar por `IDIMAGEMCA`.
- **Hipótese B** (VokeNext usa id próprio): casar por `IDVOKENEX`.

```sql
CREATE OR REPLACE PROCEDURE SNK_PROCIMPORTARIMAGEM_CA IS
BEGIN
  -- ⟨preservar aqui a lógica atual da procedure (correção já aplicada)⟩

  MERGE INTO ⟨TABELA_DESTINO_CONTRATO⟩ d
  USING (
    SELECT i.IDIMAGEMCA,
           i.IMAGEM,
           i.PERFILIMAGEM,
           i.CODPARC,
           i.ORIGEM,
           i.IDVOKENEX
    FROM   AD_IMPORTAIMAGEM i
    WHERE  i.DHINTEGRACAO IS NULL          -- só o que ainda não foi promovido
    AND    i.ORIGEM = 'VOKENEX'            -- só as imagens vindas do VokeNext
  ) s
  ON ( d.⟨CHAVE⟩ = s.⟨CHAVE⟩ )             -- A: IDIMAGEMCA · B: IDVOKENEX
  WHEN MATCHED THEN UPDATE SET
       d.IMAGEM       = s.IMAGEM,
       d.PERFILIMAGEM = s.PERFILIMAGEM,
       d.CODPARC      = s.CODPARC,
       d.ORIGEM       = s.ORIGEM,
       d.IDVOKENEX    = s.IDVOKENEX
  WHEN NOT MATCHED THEN INSERT
       ( d.⟨...colunas destino...⟩, d.ORIGEM, d.IDVOKENEX )
       VALUES
       ( s.⟨...⟩, s.ORIGEM, s.IDVOKENEX );

  -- marca como integrado SÓ o que foi promovido com sucesso
  UPDATE AD_IMPORTAIMAGEM
  SET    DHINTEGRACAO = SYSDATE
  WHERE  DHINTEGRACAO IS NULL
  AND    ORIGEM = 'VOKENEX';

  COMMIT;
EXCEPTION
  WHEN OTHERS THEN
    ROLLBACK;                              -- em erro: NÃO marca DHINTEGRACAO → reenvia depois
    RAISE;
END;
```

> **Regra de ouro do card:** *"se falhar, não marcar como integrado e reenviar."* Por isso
> `DHINTEGRACAO` só é gravado no fim, e o `EXCEPTION` faz `ROLLBACK` (deixa o registro
> disponível para nova tentativa).

### Itens a confirmar para fechar o diff
- [ ] **Corpo atual** da procedure (fonte do backup).
- [ ] Nome real de ⟨TABELA_DESTINO_CONTRATO⟩ e suas colunas.
- [ ] Chave de dedup: `IDIMAGEMCA` (hipótese A) ou `IDVOKENEX` (hipótese B).
- [ ] Como a procedure é disparada (agendada / trigger / chamada pela rotina) — para não
      duplicar a marcação de `DHINTEGRACAO`.
- [ ] `DHINTEGRACAO` = `DATE` (`SYSDATE`) ou epoch numérico, para casar com `DATACRIACAO`.
