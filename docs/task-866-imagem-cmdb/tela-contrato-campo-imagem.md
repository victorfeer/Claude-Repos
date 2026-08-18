# TASK 866 — Onde a imagem aparece na tela de contrato

Confirmado no ambiente (Construtor de Telas, HML). Fecha o fluxo ponta a ponta:
onde o dado da `AD_PLANEIMAGEM` vira campo visível para o usuário.

---

## Localização na tela

**Contrato** → aba **Planejamento** (`AD_PLANROL`, instância "Rollout", categoria
PLANEJAMENTO) → sub-aba **Rollout** → campo **"Imagem"**.

| Item | Valor |
|---|---|
| Campo na tela | `AD_PLANROL.SEQIMG` — rótulo **"Imagem"**, tipo **Número Inteiro** |
| Tipo do campo | **Ligação** (FK lookup) para `AD_PLANEIMAGEM` |
| Alvo da ligação | `AD_PLANROL.SEQIMG` → **`AD_PLANEIMAGEM.SEQ`** |
| Valor exibido | Campo de apresentação **"Cód.Imagem"** (`CODIMG`) |
| Nome interno da ligação | `AD_PLANEIMAGEM` ("Imagem CA [AD_PLANEIMAGEM]") |

Ou seja: a imagem promovida pela procedure para a `AD_PLANEIMAGEM` fica **selecionável**
no campo "Imagem" do Rollout do contrato, aparecendo pelo seu **código** (`CODIMG`).

---

## Filtro que decide QUAIS imagens aparecem (por CODPARC)

O "Filtro de formulário" da ligação restringe as imagens ao parceiro do contrato:

```sql
this.SEQ IN (
   SELECT X.SEQ FROM AD_PLANEIMAGEM X
   WHERE X.CODPARC = NVL((SELECT Z.CODPARCMATRIZ FROM TGFPAR Z WHERE Z.CODPARC = form.CODPARCCON), form.CODPARCCON)
   AND form.CODPARCCON NOT IN (3508, 5773)
   UNION ALL
   SELECT X.SEQ FROM AD_PLANEIMAGEM X
   WHERE form.CODPARCCON = 3508 AND form.CODPARCCON <> 5773
   UNION ALL
   SELECT X.SEQ FROM AD_PLANEIMAGEM X
   WHERE X.CODPARC IN (SELECT Z.CODPARC FROM TGFPAR Z WHERE Z.CODPARCMATRIZ = form.CODPARCCON)
   AND form.CODPARCCON = 5773
)
```

Leitura do filtro:
- **Caso geral:** mostra imagens cujo `AD_PLANEIMAGEM.CODPARC` = o parceiro do contrato
  (`CODPARCCON`), **resolvendo matriz**: se o parceiro tem `CODPARCMATRIZ`, usa a matriz.
- **CODPARC 3508:** caso especial — mostra **todas** as imagens (sem filtro de parceiro).
- **CODPARC 5773:** mostra as imagens de **todas as filiais** cuja matriz é 5773.

---

## Implicações diretas para o dev (TASK 866)

### 1. O `CODPARC` é o que faz a imagem aparecer no contrato certo
Isto **prova em configuração real** a exigência do card: *"enviar o CODPARC já resolvido —
sem isso a imagem entra sem cliente"*. Se o `AD_PLANEIMAGEM.CODPARC` (vindo do Run2Biz) não
casar com o `CODPARCCON` do contrato, a imagem **existe no banco mas não fica selecionável**.
➜ O `CODPARC` enviado pelo Run2Biz precisa respeitar a **regra de matriz/filial**
(`CODPARCMATRIZ`), não só "um CODPARC qualquer".

### 2. O contrato referencia a imagem por `SEQ` — o `SEQ` precisa ser estável
O contrato grava `SEQIMG = AD_PLANEIMAGEM.SEQ`. Portanto:
- A promoção **não pode trocar o `SEQ`** de uma imagem já referenciada. A procedure atual
  preserva isso (C1 só insere quando não existe por `CODIMG`; C2 dá UPDATE mantendo o `SEQ`).
- Reforça o alerta do review DBA: **`SELECT MAX(SEQ)+1` em loop é risco de corrida** — dois
  inserts concorrentes podem gerar `SEQ` colidente, e uma referência de contrato apontaria
  para a imagem errada. É mais um motivo para migrar para `SEQUENCE` no card de hardening.

### 3. O filtro do campo NÃO precisa mudar para as imagens VokeNext
O "Filtro de formulário" da ligação filtra **só por `CODPARC`/`SEQ`** — **não olha `ORIGEM`**.
Ele não distingue imagem do CA de imagem do VokeNext. Portanto, desde que a imagem VokeNext
entre na `AD_PLANEIMAGEM` com o **CODPARC correto** (`NVL(CODPARCMATRIZ, CODPARC)` do
cliente — decisão A5), ela **já aparece na pesquisa pelo bloco 1**, sem alterar o filtro.
- Mexer no filtro só seria necessário se o Run2Biz **não** mandasse o CODPARC resolvido à
  matriz (a correção certa é no envio, não no filtro), ou se quisessem **separar** as
  imagens por origem (aí `ORIGEM` entraria no filtro — melhoria, não requisito).
- **Conclusão: filtro permanece como está.**

### 4. `CODIMG` é o que o usuário vê
O campo exibe "Cód.Imagem" (`CODIMG`). É por `CODIMG` também que a procedure deduplica —
consistente. O `PERFIL` não é o valor exibido nesse campo (é o código).

---

## Observação — não confundir dois "Dt/Hr Integração"

Na sub-aba **Geral** do Rollout existe um campo **"Dt/Hr Integração"** (com "Nr. do chamado
do ITSM"). Esse é o carimbo do **rollout/chamado ITSM** (`AD_PLANROL`), **não** o
`DHINTEGRACAO` da imagem (que fica na `AD_IMPORTAIMAGEM`, staging). São coisas distintas.
