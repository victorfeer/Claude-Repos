---
name: alerta-ferias-a-vencer
description: Conhecimento completo do desenvolvimento "Alerta de Férias a Vencer" da Voke no ERP Sankhya — a solução que avisa DP, líder e colaborador (pop-up/sininho, e-mail e painel HTML5) sobre quem está com o limite de gozo de férias se aproximando, evitando a dobra trabalhista da CLT. Use SEMPRE que o usuário quiser entender, manter, corrigir, refatorar, reimplantar ou documentar esse dev. Gatilhos: "alerta de férias", "férias a vencer", "dobra de férias", "limite de gozo", "VW_ALERTA_FERIAS_A_VENCER", "STP_NOTIFICA_SISTEMA_CUSTOM", "AD_FERIAS_CONFIG", "AD_FERIAS_NOTIFICADO", "AlertaFeriasNotificacao", "notificação no sininho", "TSIAVI", "fila de e-mail TMDFMG", "CODCON/CODSMTP", "risco de acumular férias", "TFPFER", "e-mail por líder AD_EMAILLIDER", "painel de férias HTML5", "drill-through requisição de férias", "MODO_TESTE férias", ou qualquer dúvida sobre a view, a procedure, as tabelas de controle/config, o job Java (Ação Agendada/Cuckoo), a tela HTML5, a regra de elegibilidade (critérios A e B) ou o troubleshooting de e-mail/sino desse dev. NÃO use para o dev HTML5 "alertadeferias" do repositório DevsVoke (esse é um gadget de Log de Acessos que só herdou o nome da pasta) nem para dúvidas genéricas de férias do Sankhya sem relação com este alerta — aí use sankhya-dicionario/sankhya-funcionamento.
---

# Alerta de Férias a Vencer (Voke / Sankhya)

> ## ⚠️ ERRATA — corrigido após análise do artefato real
>
> Este documento foi escrito **antes** do acesso ao artefato implantado
> (`alertaferias.jar`, projeto `AlertaFeriasHml`, classes de **10/07/2026**).
> A decompilação do jar provou que alguns pontos abaixo **não correspondem** ao
> que está em produção. As correções:
>
> | Afirmação neste documento | Realidade no artefato |
> |---|---|
> | Procedure com **6 parâmetros** (`P_CODGRUPO`) | **5 parâmetros** — `P_CODGRUPO` **não existe** |
> | Sino vai para um **grupo** (`CODGRUPO_DP = 123`) | Vai para **8 `CODUSU` individuais**: 1716, 1945, 1946, 1947, 2365, 3379, 3387, 3388 |
> | Limite de gozo = `DTFINAQUI + 330` | **`FER.DTLIMGOZFER`**, com fallback `ADD_MONTHS(DTFINAQUI, 12)` |
> | Job consome a view `VW_ALERTA_FERIAS_A_VENCER` | O job **não usa a view** — tem SQL próprio, com regras diferentes |
> | Chave da `AD_FERIAS_NOTIFICADO` | `(CODEMP, CODFUNC, **SEQUENCIA**)` |
> | Pendências bloqueantes: interface Cuckoo e datasource JNDI | **Resolvidas**: `org.cuckoo.core.ScheduledAction` / `onTime(ScheduledActionContext)`; conexão vem do runtime do agendador **por reflexão** |
>
> **Fontes autoritativas:** [`divergencia-view-x-job.md`](divergencia-view-x-job.md),
> os scripts em [`../sql/`](../sql) e o código em [`../fonte-java/`](../fonte-java).


Conhecimento consolidado do desenvolvimento **Alerta de Férias a Vencer**: arquitetura, componentes, regras de negócio, decisões fechadas com o key user e o troubleshooting real enfrentado. Reconstruído a partir do histórico do projeto (conversas de 21/06/2026 a 14/07/2026).

> **Fonte da verdade é o ambiente, não esta skill.** O código-fonte final validado vive no ambiente Sankhya / Azure DevOps da Voke. Trechos marcados **CONFIRMAR** dependem de validação no ambiente real; trechos **RECONSTITUÍDO** foram inferidos do uso e devem ser conferidos contra o código real. Use esta skill como **mapa de arquitetura e decisões**, não como substituto do código definitivo.

> **Aviso de nome (não confundir):** existe no repositório `DevsVoke` uma pasta `sankhya/html5/alertadeferias/` que **NÃO é este dev** — ela contém um gadget de **Log de Acessos** (tabelas `TSIRLG`/`TSILAC`/`TSIUSU`) que apenas clonou o nome e o padrão de integração MGE deste Alerta de Férias. Este dev de férias de verdade (view + procedure + job Java + painel) não estava versionado no GitHub, só no Azure DevOps / ambiente.

## Onde aprofundar

O SKILL.md dá a visão geral e as regras. Para código e detalhes, ler o arquivo certo:

- **`references/sql-objetos.md`** — DDL completo: view `VW_ALERTA_FERIAS_A_VENCER`, procedure `STP_NOTIFICA_SISTEMA_CUSTOM`, tabelas `AD_FERIAS_CONFIG` e `AD_FERIAS_NOTIFICADO`, e o troubleshooting de banco (pacote fantasma, coluna `CODUSUREMENTI`).
- **`references/java-job.md`** — classe `AlertaFeriasNotificacao` (Ação Agendada/Cuckoo) reconstituída, modos DIFF/COMPLETO, envio via fila `TMDFMG`, e as descobertas de ambiente (CODCON/CODSMTP, `TSICON` inexistente, STATUS `Pendente`).
- **`references/frontend-deploy.md`** — tela HTML5 (painel), as **duas variantes de integração** (Action Button Java × `DbExplorerSP.executeQuery`), implantação passo a passo, homologação e estrutura de repositório recomendada.
- **`assets/painel-index.html`** — **código real** de uma versão do painel HTML5 (identidade Voke, filtros, KPIs, CSV). Ponto de partida para gerar/ajustar a tela.

## 1. Objetivo de negócio

Evitar que colaboradores acumulem um **segundo período de férias** — o que gera **pagamento em dobro** por força da CLT — avisando com antecedência o **DP**, o **colaborador (via líder)** e o **sistema (pop-up/sino)** sobre quem está com o limite de gozo se aproximando.

## 2. Como funciona (visão geral)

A solução combina seis peças que compartilham a mesma regra de negócio:

1. **View Oracle** `VW_ALERTA_FERIAS_A_VENCER` — fonte única da elegibilidade (quem deve ser avisado).
2. **Procedure PL/SQL** `STP_NOTIFICA_SISTEMA_CUSTOM` — grava o aviso no sino/pop-up nativo (`TSIAVI`).
3. **Tabela de deduplicação** `AD_FERIAS_NOTIFICADO` — evita reenviar o sino para quem já foi avisado (modo DIFF).
4. **Tabela de configuração** `AD_FERIAS_CONFIG` — parâmetros de e-mail (modo teste, destinatários) sem recompilar o `.jar`.
5. **Job Java agendado** `AlertaFeriasNotificacao` (Ação Agendada / Cuckoo) — roda **diariamente** e orquestra tudo.
6. **Fila de e-mail nativa** `TMDFMG` — o despachante do Sankhya envia; e a **tela HTML5** (painel de consulta do DP).

A rotina roda todo dia; **a própria consulta é o detector de pendência** — o colaborador permanece na lista enquanto não há férias definidas para ele e **sai automaticamente** quando o período é definido. **Não há supressão manual.**

### 2.1. Esteira de execução

1. **Detecção** — seleciona os colaboradores na janela de alerta (critérios A e B, seção 6).
2. **Pop-up** — aviso imediato ao DP (importância **Urgentíssimo** = 0).
3. **Sininho** — aviso persistente com link para o painel.
4. **Painel HTML5** — consulta completa, filtros e indicadores.
5. **Drill-through** — atalho para a Requisição de Férias no contexto do funcionário.
6. **E-mail ao líder** — cada líder recebe **apenas a sua equipe**.
7. **E-mail ao DP** — consolidado geral, **reenviado diariamente** até a resolução.

## 3. Componentes

A solução tem **dois caminhos de dados que aplicam a mesma regra, mas independentes**: o caminho do **PAINEL** (tela HTML5 → view) e o caminho do **JOB** (rotina Java). **Mantê-los sincronizados ao evoluir a regra é o principal risco do projeto** (ver seção 7).

| Componente | Tipo | Papel | Consumido por |
|---|---|---|---|
| `VW_ALERTA_FERIAS_A_VENCER` | View (Oracle) | Fonte da lista principal do painel | Tela HTML5 |
| `STP_NOTIFICA_SISTEMA_CUSTOM` | Procedure PL/SQL | Grava aviso na `TSIAVI` (pop-up/sino) | Job Java |
| `AD_FERIAS_NOTIFICADO` | Tabela | Deduplicação do sino (modo DIFF) | Job Java |
| `AD_FERIAS_CONFIG` | Tabela chave/valor | Parâmetros de e-mail sem recompilar | Job Java |
| `TMDFMG` | Tabela (fila nativa) | Fila de e-mail; despachante do Sankhya envia | Job Java |
| `AlertaFeriasNotificacao` | Ação Agendada Java | Orquestra consulta, dedup, notificação e e-mails | Agendador (CRON) |
| Painel "Alerta de férias a vencer" | Tela HTML5 | Consulta, filtros, KPIs, CSV, drill-through | Usuário DP |

## 4. Regra de vencimento (a maior suposição do modelo)

- `TFPFER.DTFINAQUI` é o **fim do período aquisitivo**.
- **`DTFINAQUI + 330`** aproxima o **fim do período concessivo** (~12 meses da CLT) antes de gerar dobra. Esse **330 fixo é a maior suposição** — a coluna derivada `LIMGOZO` usa `ADD_MONTHS(DTFINAQUI,12) - (NUMDIASFER+10) + 1`, mais preciso.
- **Confirmar com o RH** se os 330 dias fixos batem com a régua real, ou se o filtro deveria se basear no `LIMGOZO` calculado. No job Java o critério equivalente usa `DTLIMGOZFER` — **alinhar as duas definições** para que "data de vencimento" seja idêntica no painel e no e-mail.

## 5. Canais e deduplicação (decisões fechadas com o key user)

- **Um aviso de sininho por colaborador** (não uma lista concatenada), para não gerar um bloco de texto longo dentro do aviso.
- **E-mail pode ser concatenado** (lista inteira em um corpo só).
- **Deduplicação por funcionário:** quando o mesmo `CODFUNC` aparece em mais de um período na janela, mantém-se só o de **menor `DIAS_PARA_VENCER`** (mais urgente).
- **Reenvio diário do e-mail:** envia para **todos que ainda estão na consulta**, a cada execução, independente do modo DIFF. Quando o DP define o período, o colaborador sai da consulta e para de receber. **Não há supressão por `AD_FERIAS_NOTIFICADO` no canal de e-mail** (só no sino).
- **Agrupamento por líder pelo e-mail** (`AD_EMAILLIDER`), não pelo nome — evita ambiguidade de homônimos. Líder sem e-mail cadastrado vira um aviso ao DP.

## 6. Regras de negócio (elegibilidade)

Entra no alerta quem atende a **pelo menos um** dos critérios:

- **Critério A — limite de gozo próximo:** o período aquisitivo em aberto mais próximo está a **≤ 30 dias** do limite de gozo, **inclusive já vencido** (dias negativos). O alerta **não some** só porque o prazo passou — o problema continua existindo.
- **Critério B — risco de acumular (preventivo):** exatamente **1 período** aquisitivo em aberto, com o **2º ciclo** (`ADD_MONTHS(DTFINAQUI, 12)`) completando na janela de **−30 a 30 dias** — prestes a gerar 2º período acumulado, vedado pela CLT. O piso de **−30 dias** (correção de **08/07/2026**) evita capturar registros órfãos (períodos abertos há anos, nunca quitados).

**Requisição de férias pendente (não aprovada):** continua no **e-mail** e no **pop-up** (lembrete até aprovar), mas **não vai para o sininho** — implementado pela flag `ENVIAR_SINO` da view. Ao **aprovar** (`STATUS = 2`), o colaborador **sai da view** (pelo `NOT EXISTS` do WHERE) e cessa em todos os canais.

**Filtros de elegibilidade (aplicados na view — ver DDL em `references/sql-objetos.md`):**
- Empresas a partir de `CODEMP >= 20`.
- Exclui situações `0, 2, 8, 9` (Demitido, Afastado s/ remuneração, Transferido, Aposentado por invalidez). **Mantém de propósito** as situações **4/5/6** (serviço militar, licença maternidade, doença > 15 dias) — o prazo legal corre independente da situação.
- Exclui vínculos `80, 90`.
- Exclui funcionários com `DTDEM` preenchida (demitidos).
- Considera só períodos **ainda não gozados/quitados**.
- **Janela de 90 dias** de antecedência do vencimento (`DTFINAQUI + 330`) — hardcoded; parametrização é melhoria pendente.

## 7. Pontos de atenção e riscos conhecidos

- **Regra em dois lugares** (view/painel e job): manter os critérios **sincronizados** a cada evolução — é o risco central da arquitetura.
- **Alinhar `LIMGOZO` (view) com `DTLIMGOZFER` (job)** para vencimento idêntico nos dois canais.
- **Config de e-mail ainda parcialmente em constantes Java:** recomenda-se **migrar tudo para `AD_FERIAS_CONFIG`** e não recompilar o `.jar` a cada mudança de e-mail.
- **`CODGRUPO_DP = 123` é placeholder** na procedure/job — confirmar via `SELECT CODGRUPO, DESCRGRU FROM TSIGRU WHERE DESCRGRU LIKE '%DP%'`.
- **Números mágicos:** `330` (janela de vencimento) e `90` dias (antecedência) estão hardcoded — parametrização é melhoria pendente.
- **`NUAVISO` via `MAX+1`** na procedure tem risco de **race condition** em chamadas concorrentes — mantido de propósito nesta versão.
- **Drill-through:** confirmar no ambiente o formato exato de navegação/parâmetros e a **permissão de acesso** à tela de destino (`br.com.sankhya.rh.Requisicoes`).
- **Compilar a classe Java em UTF-8** para preservar a acentuação.
- O `WARN ScheduledActionsSP.isActiveJob` é da **plataforma** (camada de Ações Agendadas), **não da customização** — não impede a execução.

## 8. Implantação e homologação (resumo)

1. Aplicar os objetos de banco: view, tabelas `AD_FERIAS_NOTIFICADO`/`AD_FERIAS_CONFIG` e procedure.
2. Publicar a tela HTML5 no Sankhya.
3. Cadastrar o `.jar` como **Ação Agendada (Java)**, classe `AlertaFeriasNotificacao`, gatilho **CRON diário**.
4. Confirmar conta de e-mail do DP (`CODCON`/`CODSMTP`) e a permissão de acesso à tela de drill-through.
5. **Homologar com `MODO_TESTE` ligado**; validado, desligar para produção.

**Homologado no ambiente `erp-hml`:** pop-up e sino exibidos ao DP, navegação do sino → painel, painel com filtros/KPIs/detalhe/drill-through, e-mail por líder e consolidado ao DP entregues pela conta do DP (STATUS `Sucesso: Enviada` na `TMDFMG`), com layout Voke e acentuação corretos. Passos completos e estrutura de repositório em `references/frontend-deploy.md`.

## 9. Glossário de tabelas Sankhya usadas

| Tabela | Descrição |
|---|---|
| `TFPFER` | Períodos de férias (PK `CODEMP+CODFUNC+DTINIAQUI+SEQUENCIA`) |
| `TFPFUN` | Cadastro do funcionário (inclui `AD_LIDER`, `AD_EMAILLIDER`) |
| `TFPDEP` / `TFPCAR` | Departamento / Cargo |
| `TSIEMP` | Empresas |
| `TFPREQ` / `TFPREQADM` | Requisição de férias / dados de admissão da requisição |
| `TSIAVI` | Central de notificações (pop-up/sino) |
| `TSIGRU` | Grupos de usuário |
| `TMDFMG` / `TMDAXM` | Fila de e-mail nativa / anexos (TMDAXM não usada nesta fase) |
| `TDDOPC` | Domínio de valores (`SITUACAO`/`VINCULO`): `NUCAMPO + VALOR + OPCAO + PADRAO + ORDEM + CONTROLE + DOMAIN` |
