# TASK 866 — Criação de imagem no CMDB · Lado Sankhya (visão geral)

Visão geral do dev de imagem (VokeNext → Sankhya). Este arquivo é o **índice**; os
detalhes estão nos docs específicos citados em cada seção.

- **Board:** VOKE - TI e FM · Task 866 · Sprint 33 - Q3_2026 · Área ITSM Vokenex
- **Direção do fluxo:** VokeNext (CMDB) → **Sankhya** (import da imagem)
- **Status Sankhya:** ✅ concluído · **Status Run2Biz:** ⏳ pendente
- **Revisado:** 2026-08-19 — fatos abaixo confirmados no ambiente (HML).

## Índice dos documentos

| Arquivo | Conteúdo |
|---|---|
| `spec-campos-construtor-de-telas.md` | Spec dos 3 campos para o Construtor de Telas |
| `procedure-backup-e-atualizacao.md` | Backup + alteração da procedure |
| `SNK_PROCIMPORTARIMAGEM_CA.atualizada.sql` | Procedure já ajustada (subir) |
| `backup/SNK_PROCIMPORTARIMAGEM_CA.20260818.sql` | Fonte anterior (rollback) |
| `review-dba-procedure.md` | Review DBA + proposta de refactor (card à parte) |
| `tela-contrato-campo-imagem.md` | Onde a imagem aparece no contrato |
| `handoff-end-to-end.md` | Split Sankhya × Run2Biz |
| `texto-card-run2biz.md` | Texto pronto p/ colar na task |
| `Contrato-Integracao-Imagem-CMDB-Run2Biz.docx` | Contrato formal (papel timbrado Voke) |
| `fluxo-imagem-cmdb.html` | Diagrama visual do fluxo |

---

## 1. Fluxo (confirmado)

```
Run2Biz (CMDB)                Sankhya
──────────────                ───────────────────────────────────────────────
cadastro/alteração   ──API──▶ AD_IMPORTAIMAGEM        (staging)
de imagem                          │
(DatasetSP.save)                   │  SNK_PROCIMPORTARIMAGEM_CA (promoção)
                                   ▼
                             AD_PLANEIMAGEM          (a tabela que o contrato lê)
                                   │
                                   ▼
                   Contrato › Planejamento › Rollout · campo "Imagem"
```

## 2. Campos criados — **só na `AD_IMPORTAIMAGEM`** (staging)

| Campo | Tipo | Finalidade |
|---|---|---|
| `ORIGEM` | Texto(20) | Procedência. Valor `VOKENEX`. |
| `IDVOKENEX` | Texto(100) — GUID | Id estável da imagem no VokeNext. Rastreio/procedência. |
| `DHINTEGRACAO` | Data/Hora (DATE) | Carimbo de quando a procedure promoveu. `SYSDATE`. |

- **Não** foram criados na `AD_PLANEIMAGEM` — a rastreabilidade até o staging se faz
  pelo `IDIMAGEMCA` (já propagado). Detalhes em `spec-campos-construtor-de-telas.md`.
- `DATACRIACAO` (já existente) guarda **epoch numérico**; `DHINTEGRACAO` é `DATE` nativo.

## 3. Procedure `SNK_PROCIMPORTARIMAGEM_CA` (confirmado pelo fonte)

| Item | Situação |
|---|---|
| Entrada | `AD_IMPORTAIMAGEM` |
| Saída | **`AD_PLANEIMAGEM`** |
| Deduplicação | por **`CODIMG`** (= `IMAGEM`), via `NOT EXISTS`/`EXISTS`. **Não** por IDVOKENEX. |
| Alteração 866 | grava `DHINTEGRACAO = SYSDATE` no staging após promover cada linha |
| Transação | sem `COMMIT` interno — o chamador controla |

Fonte anterior e versão ajustada em `procedure-backup-e-atualizacao.md`. Review de
qualidade (anti-padrões `MAX(SEQ)+1`, data via string/NLS etc.) em `review-dba-procedure.md`.

## 4. Contrato de API (entrada no staging)

- **Endpoint:** `POST https://erp-hml.microcity.com.br:8443/mge/service.sbr?serviceName=DatasetSP.save&outputType=json`
- **Serviço:** `DatasetSP.save` · **Entidade:** `AD_IMPORTAIMAGEM`
- **Campos-chave:** `CODPARC` (resolvido à matriz), `IDVOKENEX`, `ORIGEM='VOKENEX'`, `STATUS=0`.

Payload completo e regras em `texto-card-run2biz.md` / `handoff-end-to-end.md`.

## 5. Status do dev

| Item | Status |
|---|---|
| Campos na `AD_IMPORTAIMAGEM` | ✅ |
| Procedure ajustada e ativa | ✅ |
| CODPARC definido (`NVL(CODPARCMATRIZ, CODPARC)`) | ✅ |
| Envio pelo Run2Biz | ⏳ pendente |
| Autenticação do gateway | ⏳ a confirmar |
| Payload exato validado contra o testado | ⏳ a confirmar |
