# TASK 866 — Criação de imagem no CMDB · Lado Sankhya

Documentação dos **campos criados** e da **atualização da procedure** que compõem a
parte já concluída no Sankhya (marcada como "Pronto" no card 866). O lado pendente
(envio pelo Run2Biz) está documentado à parte.

- **Board:** VOKE - TI e FM · Task 866 · Sprint 33 - Q3_2026
- **Área:** ITSM Vokenex
- **Direção do fluxo deste dev:** VokeNext (CMDB) → **Sankhya** (import da imagem)
- **Status Sankhya:** concluído · **Status Run2Biz:** pendente

> ⚠️ **Itens a confirmar** estão marcados com `⟨a confirmar⟩`. São dados que o card
> 866 não explicita (tipos de coluna, tabela de destino final e o diff exato da
> procedure). Confirmar com o time antes de tratar como especificação final.

---

## 1. Visão geral do lado Sankhya

O Run2Biz passa a enviar cada imagem (ISO) cadastrada/alterada no CMDB para o
Sankhya via API. O Sankhya recebe numa **tabela de importação** e depois **promove**
o registro para a tabela que o contrato efetivamente lê, através de uma procedure.

```
Run2Biz (CMDB)                Sankhya
──────────────                ───────────────────────────────────────────────
cadastro/alteração   ──API──▶ AD_IMPORTAIMAGEM        (tabela de importação/staging)
de imagem                          │
(DatasetSP.save)                   │  SNK_PROCIMPORTARIMAGEM_CA (rotina de promoção)
                                   ▼
                             ⟨tabela de imagem que o contrato lê⟩
```

Dois pilares:
1. **Campos de rastreio de origem e data** criados nas tabelas envolvidas.
2. **Procedure de promoção** `SNK_PROCIMPORTARIMAGEM_CA` corrigida e ativada.

---

## 2. Campos criados

Três campos de rastreabilidade foram adicionados para identificar a origem
externa da imagem e garantir idempotência (não duplicar) e reprocessamento.

| Campo | Finalidade | Tipo (⟨a confirmar⟩) | Observações |
|---|---|---|---|
| `ORIGEM` | Marca a procedência do registro. Para este fluxo o valor é **`VOKENEX`**. | `VARCHAR2` ⟨tamanho a confirmar⟩ | Permite distinguir imagens vindas do VokeNext das demais. Usado como filtro pela procedure de promoção. |
| `IDVOKENEX` | **Id estável por imagem** vindo do VokeNext. Chave de deduplicação. | ⟨a confirmar — `VARCHAR2` ou `NUMBER`⟩ | Garante que reenvios da mesma imagem **atualizem** em vez de duplicar. É o `id` estável citado no contrato ("usar um id estável por imagem para não duplicar"). |
| `DHINTEGRACAO` | Data/hora em que o registro foi integrado/promovido. | `DATE` | Controle de "quando entrou". Distinto do `DHINTEGRACAO` genérico da `AD_TGFINTE` (aquele é do fluxo de pedidos/ITSM) — aqui é o carimbo da importação de imagem. |

**Onde os campos foram criados:** nas tabelas do fluxo de imagem — a tabela de
importação `AD_IMPORTAIMAGEM` e a ⟨tabela de destino que o contrato lê — nome a
confirmar⟩. O card diz literalmente "campos de origem e data criados **nas
tabelas**" (plural).

### Convenção de uso
- Ao inserir uma imagem vinda do VokeNext: `ORIGEM = 'VOKENEX'`, `IDVOKENEX = <id estável da imagem>`.
- `DHINTEGRACAO` é preenchido no momento da promoção (não no cadastro no Run2Biz).
- Se a integração **falhar**, o registro **não** deve ser marcado como integrado
  (regra do lado Run2Biz — ver contrato), permitindo reenvio.

---

## 3. Tabela de importação — `AD_IMPORTAIMAGEM`

Tabela de staging que a API do Sankhya grava via `DatasetSP.save`. É o destino
direto do `POST .../mge/service.sbr` enviado pelo Run2Biz.

- **Recebe:** payload da imagem + `CODPARC` (parceiro Sankhya **já resolvido** —
  sem ele a imagem entra sem cliente), `ORIGEM = 'VOKENEX'`, `IDVOKENEX`.
- **Não é** a tabela final: serve de entrada para a procedure de promoção.

> Estrutura completa de colunas de `AD_IMPORTAIMAGEM`: ⟨a confirmar — extrair o DDL
> do ambiente de HML `erp-hml.microcity.com.br`⟩.

---

## 4. Procedure de promoção — `SNK_PROCIMPORTARIMAGEM_CA`

**Papel:** ler os registros de `AD_IMPORTAIMAGEM` (as imagens importadas do
VokeNext) e **promovê-los** para a tabela de imagem que o contrato efetivamente
lê. É a ponte entre o staging e o dado "oficial".

| Item | Situação |
|---|---|
| Estado | **Corrigida e ativa** (conforme card) |
| Entrada | `AD_IMPORTAIMAGEM` (registros com `ORIGEM = 'VOKENEX'`) |
| Saída | ⟨tabela de imagem lida pelo contrato — nome a confirmar⟩ |
| Deduplicação | via `IDVOKENEX` (id estável) |
| Carimbo | grava `DHINTEGRACAO` na promoção |

### A confirmar sobre a correção
O card informa apenas que a procedure foi **"corrigida e ativa"**, sem detalhar o
que foi corrigido. Para fechar esta documentação, confirmar:
- ⟨O que estava quebrado antes da correção?⟩
- ⟨O código atual da `SNK_PROCIMPORTARIMAGEM_CA` (corpo da procedure)?⟩
- ⟨Como ela é disparada? (agendada, trigger na `AD_IMPORTAIMAGEM`, ou chamada pela rotina)⟩
- ⟨Regra de idempotência: UPDATE quando `IDVOKENEX` já existe vs. INSERT novo?⟩

---

## 5. Contrato de API (referência do lado Sankhya)

- **Endpoint:** `POST https://erp-hml.microcity.com.br:8443/mge/service.sbr`
  ⟨query string / serviceName completo a confirmar — trecho cortado no card⟩
- **Serviço:** `DatasetSP.save`
- **Entidade destino:** `AD_IMPORTAIMAGEM`
- **Campos obrigatórios no payload:**
  - `CODPARC` — parceiro Sankhya **já resolvido** no lado Run2Biz.
  - `IDVOKENEX` — id estável da imagem.
  - `ORIGEM` — fixo `VOKENEX`.
  - ⟨demais campos da imagem (nome/arquivo/ISO) — a confirmar no payload completo⟩

> **Pendência para completar esta seção:** o corpo/payload completo do contrato está
> cortado no comentário do card 866 (a partir de "Payload do novo contrato"). Colar o
> restante para documentar campo a campo.

---

## 6. Checklist do que ainda falta confirmar

- [ ] Tipos e tamanhos de `ORIGEM`, `IDVOKENEX`, `DHINTEGRACAO`.
- [ ] Nome da tabela de destino final ("a tabela que o contrato lê").
- [ ] DDL completo de `AD_IMPORTAIMAGEM`.
- [ ] Corpo atual e forma de disparo da `SNK_PROCIMPORTARIMAGEM_CA`.
- [ ] Query string / payload completo do `POST .../service.sbr`.
