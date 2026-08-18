# TASK 866 — Handoff end-to-end (Sankhya × Run2Biz)

O que precisa acontecer, dos dois lados, para a imagem do CMDB do VokeNext aparecer
no campo **Imagem** do contrato (Planejamento › Rollout).

Fluxo: **Run2Biz** grava no staging via API → **procedure** promove para
`AD_PLANEIMAGEM` → **contrato** lê pelo `CODPARC`.

---

## A) Seu lado (Sankhya) — o que alterar

| # | Ação | Status |
|---|---|---|
| A1 | Criar `ORIGEM`, `IDVOKENEX`, `DHINTEGRACAO` na `AD_IMPORTAIMAGEM` | ✅ feito |
| A2 | Backup da procedure (`backup/SNK_PROCIMPORTARIMAGEM_CA.20260818.sql`) | ✅ no repo |
| A3 | Subir `SNK_PROCIMPORTARIMAGEM_CA.atualizada.sql` (carimba `DHINTEGRACAO`) | ⏳ subir |
| A4 | Confirmar que a procedure está **ativa/agendada** (quem a dispara e dá COMMIT) | ⏳ validar |
| A5 | Definir com o time **qual `CODPARC`** o Run2Biz deve enviar (regra matriz/filial) | ⏳ definir |

> A3 é opcional para a imagem *aparecer* (isso a procedure já faz). É obrigatório se você
> quer o `DHINTEGRACAO` preenchido. Recomendado subir.
>
> **A5 é o item que ninguém pode pular:** o campo do contrato só lista imagens cujo
> `AD_PLANEIMAGEM.CODPARC` bate com o parceiro do contrato, **resolvendo matriz**
> (`CODPARCMATRIZ`), com exceções para `CODPARC` 3508 e 5773. Então o Run2Biz precisa
> mandar o `CODPARC` **certo** segundo essa regra — não um qualquer. Ver
> `tela-contrato-campo-imagem.md`.

### (Futuro, card à parte) Hardening da procedure
`SEQUENCE` no lugar de `MAX(SEQ)+1`, datas sem string/NLS, set-based, `TO_NUMBER` seguro,
log de erro por linha. Ver `review-dba-procedure.md`. **Não** faz parte do 866.

---

## B) Lado Run2Biz — o que levar para eles

Implementar: ao **cadastrar/alterar** uma imagem no CMDB do VokeNext, **chamar a API do
Sankhya** e gravar na `AD_IMPORTAIMAGEM`.

| # | Requisito | Detalhe |
|---|---|---|
| B1 | Chamar `DatasetSP.save` (POST `/mge/service.sbr`) inserindo na `AD_IMPORTAIMAGEM` | contrato abaixo |
| B2 | Enviar **`CODPARC` já resolvido** respeitando **matriz/filial** | ver A5 — é o que faz a imagem aparecer no contrato certo |
| B3 | Enviar **`IDVOKENEX`** = id estável da imagem | chave de idempotência (não reenviar duplicado) |
| B4 | Enviar **`ORIGEM` = `VOKENEX`** | marca a procedência |
| B5 | Enviar **`STATUS = 0`** para imagem ativa | a procedure só promove novos com `status = 0`; `0`→ATIVO 'S', ≠0→'N' |
| B6 | Enviar os dados da imagem: `IMAGEM` (código), `PERFILIMAGEM`, `DATACRIACAO` (epoch em segundos), `IDIMAGEMCA` (GUID) | `IMAGEM`/`CODIMG` é a chave de dedup e o que aparece na tela |
| B7 | **Idempotência**: usar o id estável para não duplicar | reenvio deve atualizar, não criar outro |
| B8 | **Tratar erro**: se a API falhar, **não** marcar como integrado no Run2Biz e **reenviar** | |
| B9 | **Autenticar** no gateway Sankhya | token/login — confirmar método com o time Sankhya |

### Contrato da API (entrada no staging)

```
POST https://erp-hml.microcity.com.br:8443/mge/service.sbr?serviceName=DatasetSP.save
Content-Type: application/json
Authorization: <definir — token/login do gateway Sankhya>
```

```json
{
  "serviceName": "DatasetSP.save",
  "requestBody": {
    "entityName": "AD_IMPORTAIMAGEM",
    "standAlone": false,
    "fields": ["IMAGEM","PERFILIMAGEM","CODPARC","DATACRIACAO","STATUS","ORIGEM","IDVOKENEX","IDIMAGEMCA"],
    "records": [
      {
        "values": {
          "0": "33.36",
          "1": "Padrão",
          "2": "<CODPARC resolvido (matriz/filial)>",
          "3": "1523066035",
          "4": "0",
          "5": "VOKENEX",
          "6": "<id estável da imagem no VokeNext>",
          "7": "A034783C192D3A4F93C422A5E26D564B"
        }
      }
    ]
  }
}
```
Os índices em `values` correspondem à posição no array `fields`.

---

## C) Pendências que travam o fechamento

- [ ] **A5/B2** — regra exata do `CODPARC` a enviar (matriz/filial; casos 3508 e 5773).
- [ ] **B9** — método de autenticação do `/mge/service.sbr`.
- [ ] **Payload completo** do card (o trecho após "Payload do novo contrato" veio cortado).
- [ ] Semântica de `STATUS` além de 0/1 (se houver outros valores).

---

## Resumo em uma linha

**Sankhya:** campos criados (✅), subir a procedure do carimbo (⏳) e definir o CODPARC
correto (⏳). **Run2Biz:** implementar o envio via `DatasetSP.save` com CODPARC resolvido,
IDVOKENEX, ORIGEM=VOKENEX, STATUS=0 e idempotência/retentativa.
