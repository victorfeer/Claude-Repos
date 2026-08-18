# TASK 866 — Especificação técnica dos campos (Construtor de Telas)

Especificação para criação dos três campos de rastreio da integração de imagem
(VokeNext → Sankhya) via **Construtor de Telas** do Sankhya.

Campos: `ORIGEM`, `IDVOKENEX`, `DHINTEGRACAO`.

> **Regra de prefixo — ler antes de criar:**
> - Em **tabela customizada** (`AD_IMPORTAIMAGEM` e demais `AD_*`): crie os campos com
>   o nome **exato** — `ORIGEM`, `IDVOKENEX`, `DHINTEGRACAO` (sem prefixo).
> - Em **tabela padrão do Sankhya** (se a "tabela que o contrato lê" for padrão, ex.
>   uma TCB/TGF): o Construtor de Telas **força o prefixo `AD_`** em campos de usuário
>   → ficarão `AD_ORIGEM`, `AD_IDVOKENEX`, `AD_DHINTEGRACAO`. Ajustar os nomes no
>   contrato/procedure conforme o caso. ⟨Confirmar a natureza da tabela de destino.⟩

---

## Caminho no Sankhya

`Construtor de Telas` → selecionar a **instância/entidade** da tabela
(`AD_IMPORTAIMAGEM` e a tabela de destino) → aba/grade de **Campos** → **Inserir**
→ preencher com a spec abaixo → **Salvar** → **Aplicar alterações no banco**.

---

## 1. `ORIGEM` — procedência do registro

| Propriedade (Construtor de Telas) | Valor |
|---|---|
| **Nome do campo** | `ORIGEM` *(padrão → `AD_ORIGEM`)* |
| **Descrição / Rótulo** | `Origem` |
| **Tipo** | **Texto** (`VARCHAR2`) |
| **Tamanho** | `20` |
| **Casas decimais** | — |
| **Obrigatório** | **Não** *(a origem só é setada por integração; deixar opcional não quebra inserts existentes)* |
| **Valor padrão** | *(vazio)* — a integração grava `VOKENEX` |
| **Chave primária** | Não |
| **Campo de pesquisa** | Sim *(usado como filtro pela procedure)* |
| **Domínio / opções** | Opcional: criar opção fixa `VOKENEX = Integração VokeNext` |

DDL equivalente: `ORIGEM VARCHAR2(20)`

---

## 2. `IDVOKENEX` — id estável da imagem (chave de deduplicação)

| Propriedade (Construtor de Telas) | Valor |
|---|---|
| **Nome do campo** | `IDVOKENEX` *(padrão → `AD_IDVOKENEX`)* |
| **Descrição / Rótulo** | `Id VokeNext` |
| **Tipo** | **Texto** (`VARCHAR2`) — recomendado |
| **Tamanho** | `100` |
| **Casas decimais** | — |
| **Obrigatório** | **Não** na tabela; **obrigatório na regra de integração** *(sem id não há como deduplicar)* |
| **Valor padrão** | *(vazio)* |
| **Chave primária** | Não — mas criar **índice único** por `IDVOKENEX` (ou `IDVOKENEX + ORIGEM`) para impedir duplicidade |
| **Campo de pesquisa** | Sim |

**Por que Texto e não Número:** o id do VokeNext pode ser UUID/GUID alfanumérico. Texto
absorve numérico e alfanumérico sem risco. ⟨Se o time confirmar que o id é
estritamente numérico, trocar para **Inteiro/`NUMBER`**.⟩

DDL equivalente: `IDVOKENEX VARCHAR2(100)` + `CREATE UNIQUE INDEX AK_IMPIMG_IDVOKENEX ON AD_IMPORTAIMAGEM (IDVOKENEX)`

---

## 3. `DHINTEGRACAO` — data/hora da integração

| Propriedade (Construtor de Telas) | Valor |
|---|---|
| **Nome do campo** | `DHINTEGRACAO` *(padrão → `AD_DHINTEGRACAO`)* |
| **Descrição / Rótulo** | `Dt. Integração` |
| **Tipo** | **Data/Hora** (`DATE`, com hora) |
| **Tamanho** | — |
| **Casas decimais** | — |
| **Obrigatório** | **Não** *(preenchido só na promoção; nulo = ainda não integrado/promovido)* |
| **Valor padrão** | *(vazio)* — a procedure grava `SYSDATE` na promoção |
| **Chave primária** | Não |
| **Campo de pesquisa** | Sim *(filtrar não-integrados: `DHINTEGRACAO IS NULL`)* |

DDL equivalente: `DHINTEGRACAO DATE`

> **Nota:** manter `DHINTEGRACAO` **nulo** enquanto não promovido é o que sustenta a
> regra "se falhar, não marcar como integrado e reenviar" (card, lado Run2Biz). O
> preenchimento é a marca de sucesso.

---

## Resumo (tabela única)

| Campo | Tipo Sankhya | Tamanho | Obrigatório | Índice único | Valor gravado |
|---|---|---|---|---|---|
| `ORIGEM` | Texto | 20 | Não | — | `VOKENEX` (pela integração) |
| `IDVOKENEX` | Texto | 100 | Não (mas exigido na regra) | **Sim** (dedup) | id estável da imagem |
| `DHINTEGRACAO` | Data/Hora | — | Não | — | `SYSDATE` na promoção |

## DDL completo (referência — se preferir criar direto no banco)

```sql
ALTER TABLE AD_IMPORTAIMAGEM ADD (
  ORIGEM        VARCHAR2(20),
  IDVOKENEX     VARCHAR2(100),
  DHINTEGRACAO  DATE
);

COMMENT ON COLUMN AD_IMPORTAIMAGEM.ORIGEM       IS 'Origem do registro. VOKENEX = integracao VokeNext/Run2Biz.';
COMMENT ON COLUMN AD_IMPORTAIMAGEM.IDVOKENEX    IS 'Id estavel da imagem no VokeNext. Chave de deduplicacao.';
COMMENT ON COLUMN AD_IMPORTAIMAGEM.DHINTEGRACAO IS 'Data/hora da promocao/integracao. Nulo = ainda nao integrado.';

CREATE UNIQUE INDEX AK_IMPIMG_IDVOKENEX ON AD_IMPORTAIMAGEM (IDVOKENEX);
```

> Ao criar pelo Construtor de Telas, **não** rode este DDL à mão — o próprio Construtor
> aplica a alteração no banco ao salvar. O bloco acima é só referência de tipos/comentários.

## Pontos a confirmar com o time

- [ ] Tabela de destino ("que o contrato lê") é **padrão** ou **AD_**? Define o prefixo.
- [ ] `IDVOKENEX` é numérico ou UUID? Define Texto vs. Inteiro.
- [ ] Tamanho real de `IDVOKENEX` no VokeNext (para dimensionar o `VARCHAR2`).
- [ ] Índice único deve ser por `IDVOKENEX` sozinho ou `IDVOKENEX + ORIGEM`?
