# Review DBA — `SNK_PROCIMPORTARIMAGEM_CA`

Revisão crítica do fonte real (staging `AD_IMPORTAIMAGEM` → destino `AD_PLANEIMAGEM`),
sob a ótica de boas práticas de banco/PL-SQL. Separa **a decisão da TASK 866** da
**saúde da procedure**.

---

## Veredito rápido

1. **Para a TASK 866, a escolha foi a certa.** Adicionar os campos no staging e fazer
   uma alteração **cirúrgica** (só carimbar `DHINTEGRACAO`), sem reescrever a procedure,
   é a decisão correta de baixo risco. Não se refatora procedure de produção "de carona"
   numa task de criação de campo. ✅
2. **A procedure em si NÃO é bem construída.** Ela funciona, mas carrega 4 anti-padrões
   clássicos que um DBA marcaria para um **refactor à parte** (não agora, não no 866).

Ou seja: a alteração do 866 está boa; a procedure herdada tem dívida técnica real que
vale endereçar num card separado de hardening.

---

## Achados (ordenados por severidade)

### 🔴 1. `SELECT NVL(MAX(SEQ),0)+1` dentro do loop — geração de PK caseira
```sql
SELECT NVL(MAX(SEQ),0) +1 INTO P_SEQ FROM AD_PLANEIMAGEM;   -- a cada iteração
```
- **Concorrência:** duas execuções simultâneas (ou o schedule sobrepondo) calculam o
  **mesmo** `SEQ` → colisão de PK ou linha duplicada. É condição de corrida clássica.
- **Performance:** um `MAX()` varrendo `AD_PLANEIMAGEM` **a cada linha** inserida →
  O(n×m). Com a tabela crescendo, degrada.
- **Boa prática:** usar **`SEQUENCE`** (ou coluna `IDENTITY`/`GENERATED`), que é atômica
  e livre de corrida.

### 🔴 2. Data ida-e-volta por string, dependente de NLS
```sql
... to_char(<data>,'dd/mm/yyyy') AS DATA_CRIACAO      -- vira string, perde a hora
INSERT ... VALUES(..., TO_DATE(R1.DATA_CRIACAO), ...) -- TO_DATE SEM máscara
```
- `TO_DATE` **sem máscara** usa o `NLS_DATE_FORMAT` da sessão. Se a sessão que roda a
  procedure não estiver em `dd/mm/yyyy`, dá **ORA-01843 / ORA-01858** ou interpreta
  errado (mês×dia). É bug latente que "funciona na minha máquina".
- Converter para `'dd/mm/yyyy'` **descarta a hora** — se `DTCRIACAO` devesse ter hora,
  já perdeu.
- **Boa prática:** nunca faça `DATE → string → DATE`. Mantenha `DATE` o tempo todo e,
  se precisar de máscara, **sempre explícita**: `TO_DATE(x,'dd/mm/yyyy')`.

### 🟠 3. Base do epoch é uma constante mágica não documentada
```sql
to_date('30.12.1969 21','dd.mm.yyyy HH24:mi:ss') + (img.datacriacao/86400)
```
- O epoch Unix canônico é **`1970-01-01 00:00:00 UTC`**. `30.12.1969 21:00` é ~27h antes
  disso — provavelmente um ajuste empírico de fuso/borda que ninguém mais entende.
- Além disso a string `'30.12.1969 21'` não traz `:mi:ss` que a máscara pede (o Oracle
  tolera preenchendo com zero, mas é descuidado).
- **Boa prática:** base canônica + fuso explícito, com comentário do porquê:
  `DATE '1970-01-01' + img.datacriacao/86400` (ajustar TZ se necessário) — **e validar
  que bate com a saída atual antes de trocar** (a constante pode codificar um offset real).

### 🟠 4. Processamento linha-a-linha (slow-by-slow) em vez de set-based
- Dois `FOR ... LOOP` com DML de uma linha por vez. Para importação de staging, o padrão
  é **set-based**: um `INSERT ... SELECT` e um `UPDATE`/`MERGE`. Mais rápido, atômico por
  statement e menos código.
- O carimbo de `DHINTEGRACAO` que o 866 adiciona também vira **um único UPDATE** no fim,
  em vez de um por linha.

### 🟡 5. `TO_NUMBER(img.codparc)` sem proteção
- Se algum `CODPARC` vier com lixo (espaço, letra, vazio), estoura **ORA-01722** e
  derruba o lote inteiro — e como não há tratamento de erro, sem log de qual linha.
- **Boa prática (12.2+):** `TO_NUMBER(img.codparc DEFAULT NULL ON CONVERSION ERROR)` +
  descartar/logar os nulos; ou filtrar `WHERE REGEXP_LIKE(img.codparc,'^\d+$')`.

### 🟡 6. Sem tratamento de erro / sem log
- Zero `EXCEPTION`. Numa integração, o padrão é capturar erro **por linha** e gravar em
  tabela de log (id da imagem + mensagem), seguindo o lote. Hoje, um registro ruim aborta
  tudo silenciosamente.

### 🟡 7. Detecção de mudança (C2) ignora `PERFIL` e data
- C2 só reprocessa quando muda `STATUS` **ou** `CODPARC`. Se mudar só o `PERFILIMAGEM`,
  não é detectado — e o `UPDATE` também não atualiza `PERFIL`. Mudança de perfil nunca
  propaga. Gap de correção pequeno, mas real.

### 🟢 8. Chave de match é `CODIMG` (código), não o GUID `IDIMAGEMCA`
- Casa por `IMAGEM`/`CODIMG` (ex. `33.36`), enquanto carrega o `IDIMAGEMCA` (GUID, mais
  estável) só como payload. Se `IMAGEM` não tiver unicidade garantida, há risco de casar
  linha errada. **Questão de design** — não mexer sem validar unicidade e alinhar com o
  time; o GUID tende a ser a identidade mais confiável.

### 🟢 9. Sem `COMMIT` interno
- Correto **se** a procedure roda dentro de uma transação controlada pelo chamador (é o
  caso e sustenta "se falhar, não marca como integrado"). Só precisa estar **documentado**;
  se um dia rodar avulsa/agendada, precisa de `COMMIT` no ponto certo.

---

## O que fazer (recomendação de rollout)

| Momento | Ação |
|---|---|
| **Agora (TASK 866)** | Subir a versão cirúrgica (só carimbo `DHINTEGRACAO`). Baixo risco. |
| **Card de hardening (à parte)** | Refatorar: `SEQUENCE`, datas sem string/NLS, set-based, `TO_NUMBER` seguro, log de erro por linha, revisar chave de match e detecção de mudança. |

Não misturar os dois: a força da entrega do 866 está justamente em **não** tocar na
lógica herdada.

---

## Proposta de refactor (para o card de hardening — validar em HML)

> ⚠️ Não aplicar junto com o 866. Requer validação da conversão de data e de unicidade
> de `CODIMG`. MERGE exige fonte sem `CODIMG` duplicado (senão ORA-30926).

```sql
-- 1) Sequence para o SEQ (semear a partir do máximo atual, uma única vez)
--    SELECT NVL(MAX(SEQ),0)+1 FROM AD_PLANEIMAGEM;  -> usar como START WITH
CREATE SEQUENCE AD_SEQ_PLANEIMAGEM START WITH <max+1> INCREMENT BY 1 NOCACHE;

CREATE OR REPLACE PROCEDURE snk_procimportarimagem_ca
AS
BEGIN
  -- INSERT set-based dos novos (não existentes em AD_PLANEIMAGEM)
  INSERT INTO AD_PLANEIMAGEM (SEQ, CODIMG, PERFIL, CODPARC, DTCRIACAO, ATIVO, IDIMAGEMCA)
  SELECT AD_SEQ_PLANEIMAGEM.NEXTVAL,
         img.imagem,
         img.perfilimagem,
         TO_NUMBER(img.codparc DEFAULT NULL ON CONVERSION ERROR),
         DATE '1970-01-01' + (img.datacriacao/86400),   -- validar TZ vs. saída atual
         'S',
         img.idimagemca
  FROM   AD_IMPORTAIMAGEM img
  WHERE  img.status = 0
  AND    NOT EXISTS (SELECT 1 FROM AD_PLANEIMAGEM g WHERE g.CODIMG = img.imagem);

  -- UPDATE set-based dos alterados (inclui PERFIL na detecção e na gravação)
  MERGE INTO AD_PLANEIMAGEM d
  USING (
    SELECT img.imagem AS CODIMG, img.perfilimagem AS PERFIL,
           TO_NUMBER(img.codparc DEFAULT NULL ON CONVERSION ERROR) AS CODPARC,
           img.idimagemca AS IDIMAGEMCA,
           CASE WHEN img.status = 0 THEN 'S' ELSE 'N' END AS ATIVO
    FROM   AD_IMPORTAIMAGEM img
  ) s
  ON (d.CODIMG = s.CODIMG)
  WHEN MATCHED THEN UPDATE SET
       d.ATIVO = s.ATIVO, d.PERFIL = s.PERFIL, d.CODPARC = s.CODPARC,
       d.IDIMAGEMCA = s.IDIMAGEMCA, d.DHALTER = SYSDATE
  WHERE (d.ATIVO <> s.ATIVO OR d.CODPARC <> s.CODPARC OR d.PERFIL <> s.PERFIL);

  -- Carimbo de integrado, em um único statement
  UPDATE AD_IMPORTAIMAGEM
  SET    DHINTEGRACAO = SYSDATE
  WHERE  DHINTEGRACAO IS NULL
  AND    EXISTS (SELECT 1 FROM AD_PLANEIMAGEM g WHERE g.CODIMG = AD_IMPORTAIMAGEM.imagem);

  -- COMMIT fica com o chamador (mesma premissa do original).
END;
/
```

**Ganhos:** sem corrida de PK, sem dependência de NLS, sem varredura por linha, conversão
de `CODPARC` segura, detecção de mudança completa (inclui perfil). **Custo:** exige
validar a conversão de data e a unicidade de `CODIMG` antes de trocar.
