# Tela HTML5, implantação e homologação

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


## 1. Tela HTML5 — "Alerta de férias a vencer"

> **Código real disponível:** `assets/painel-index.html` (na pasta desta skill) é uma versão real da tela. Use-a como ponto de partida para gerar/ajustar o painel em vez de reescrever do zero.

Componente HTML5 com a identidade visual da Voke, publicado no Sankhya.

### Duas variantes de integração (atenção)

Existem **duas formas** de a tela buscar os dados, dependendo da versão — confirmar qual está publicada no ambiente antes de mexer:

- **Variante Action Button Java** (a de `assets/painel-index.html`): faz `POST` num endpoint de Action Button, ex.: `/mge/service.sbr?serviceName=ACTIONBUTTON.alertaFeriasVencer`, enviando um **payload JSON** (`{ diasAntecedencia, codEmp, codDep, codFunc }`) e lendo um **array JSON** de linhas (`razaoSocial`, `nomeFunc`, `codFunc`, `descrDep`, `descrCargo`, `lider`, `dtIniAqui`, `dtFinAqui`, `numDiasFer`, `abonoPec`, `faltas`, `limGozo`, `diasParaVencer`). A classe Java (`AlertaFeriasVencerAction`) monta o SELECT e serializa o JSON.
- **Variante `DbExplorerSP.executeQuery`**: a tela roda a query direta (`FROM VW_ALERTA_FERIAS_A_VENCER`) via o serviço genérico do MGE, **sem** Action Button dedicado — abordagem também confirmada como suficiente com o usuário.

A regra de negócio (janela, faixas de urgência) é a mesma; muda só o transporte. Se alinhar a "fonte da verdade" numa só, prefira apontar a tela para a mesma base do job.

### Identidade visual (Voke)

Bege `#E3DDC9`, azul marinho `#1B3D6D`, rosa `#F3A0C3`; fontes **Space Grotesk** (display) e **Space Mono** (mono/rótulos). Cabeçalho com marca "voke · RH · Gestão de Férias" e um SVG de circuito decorativo. Ver `assets/painel-index.html` para o CSS completo e a paleta de tokens.

- **Fontes de dados:** lista principal pela view `VW_ALERTA_FERIAS_A_VENCER`; "risco de acumular" por **consulta direta separada** (mescladas por funcionário).
- **Filtros:** **Empresa** (dropdown de `TSIEMP`, "Todas" como padrão), **Departamento** (dropdown, "Todos"), **Funcionário** (código ou nome, busca livre) e **Antecedência (dias)** — input numérico com padrão **90** (1–365). No `assets/painel-index.html` os dropdowns começam vazios e são populados dinamicamente; ligar o carregamento de empresas/departamentos ao publicar.
- **Indicadores (KPIs) — 4 cards clicáveis:** **Risco de acumular**, **Crítico** (≤ 15 dias), **Atenção** (≤ 30 dias) e **Dentro do prazo** (> 30 dias). Clicar num card filtra a tabela por aquela faixa; clicar de novo (ou no card já ativo) volta a mostrar todos. Os contadores são sempre o total de cada faixa (não recalculam sobre o subconjunto).
- **Vencimento = `ADD_MONTHS(DTFINAQUI, 12)`** (fim do período concessivo, ~12 meses da CLT) — é o que a tela rica exibe como "Data vencimento" (ex.: fim aquisitivo 15/06/2025 → vencimento 15/06/2026). **Não** usa o `DTFINAQUI + 330` da variante anterior. `DIAS_PARA_VENCER = ADD_MONTHS(DTFINAQUI,12) - TRUNC(SYSDATE)`.
- **Faixas de urgência (JS `faixaDe`):** `dias < 0` → **Risco de acumular** (já passou do vencimento → risco do 2º período acumulado); `0..15` → Crítico; `16..30` → Atenção; `> 30` → Dentro do prazo. Janela SQL com **piso de −30 dias** (`ADD_MONTHS(DTFINAQUI,12) BETWEEN TRUNC(SYSDATE)-30 AND TRUNC(SYSDATE)+antecedência`) — o piso −30 é a correção de 08/07/2026 que evita puxar registros órfãos antigos.
- **Tabela condensada + accordion:** colunas **Urgência, Funcionário (nome+código), Líder, Data vencimento, Dias p/ vencer**. **Clicar na linha expande** um detalhe com Empresa, Departamento, Cargo, Dias de férias, Início/Fim aquisitivo, **Abono**, **Faltas** e o botão de drill-through. Linha tingida pela faixa (risco = rosa, crítico = vermelho claro, atenção = âmbar).
- **Exportação:** botão **Exportar** gera **CSV** da última consulta (separador `;`, `charset=utf-8`, download via Blob).
- **Drill-through — botão "Abrir requisição de férias":** abre a tela de **Requisições** do RH. IDs **confirmados no ambiente `erp-hml`** (diálogo "Configurar tela"):
  - Caminho: *Pessoal+ » Rotinas Folha » Requisições*
  - **ID:** `br.com.sankhya.rh.Requisicoes`
  - **Global ID (nuGadget/resourceID):** `BFF43734574F1D0937C6FA91C0FF9D58`
  - **Comportamento observado:** a tela de Requisições é um **assistente** ("Qual requisição você deseja criar? → Férias"); ela **abre genérica**, sem pré-selecionar o funcionário. O deep-link do gadget consegue **abrir a tela**, mas o Sankhya normalmente **não aceita passar `CODEMP`/`CODFUNC` para pré-filtrar** esse wizard — então o DP escolhe o funcionário na própria tela de Requisições. Se for preciso pré-preencher, avaliar um recurso/atalho parametrizado no ambiente (fora do que o HTML5 sozinho faz).
  - **⭐ Como abrir a tela de Requisições a partir do gadget — SOLUÇÃO FINAL (validada pelo usuário: "deu certo"):** a função `abrirRequisicoes` faz **três passos**, nesta ordem. Os três são necessários — nenhum sozinho resolve.

    **Passo 1 — achar o `workspace` DESCENDO, nunca subindo.** O objeto `workspace` **NÃO está na cadeia de frames-pai** do gadget: ele vive num **iframe IRMÃO**, alcançável **descendo** do topo (`top` → `document.querySelectorAll('iframe')` → `contentWindow.workspace`), recursivamente. A primeira versão só **subia** (`window` → `parent` → … → `top`) e achava **0 workspaces** → "clico e não abre nada". A varredura descendo acha `WORKSPACES: 1`.

    **Passo 2 — chamar o método nativo E VERIFICAR SE ABRIU.**
    ```js
    workspace.openActivityResourceID("br.com.sankhya.rh.Requisicoes");
    ```
    **🚨 A ARMADILHA QUE CUSTOU HORAS:** neste ambiente essa chamada **executa sem lançar exceção e NÃO abre nada** (no-op silencioso). Um teste de console retornou `>>> OK` e foi interpretado como sucesso — mas `>>> OK` significava apenas *"não deu erro"*, **não** *"abriu"*. **Regra: nunca aceitar ausência de exceção como prova de que a tela abriu.** A verificação correta é **contar as abas do workspace antes e depois** da chamada (`querySelectorAll("[id^='tab'],.tab-item,.gwt-TabLayoutPanelTab,li[role='tab']")` em todas as janelas varridas); só houve abertura se o número **aumentou**.

    **Passo 3 — fallback garantido: deep-link na PRÓPRIA aba.** Se o passo 2 não aumentou a contagem de abas, navegar a **aba atual** para:
    ```js
    top.location.href = origin + "/mge/system.jsp#app/" + btoa("br.com.sankhya.rh.Requisicoes");
    ```
    Por ser a **mesma aba** do navegador, o `sessionStorage` (onde vive a sessão do Sankhya) é **preservado** → **não pede login** e **não abre aba nova**. É o caminho que efetivamente abre a tela neste ambiente.

  - **⚠️ Armadilhas que NÃO funcionam** (comprovadas neste dev — não repetir, custaram horas):
      - **`openApp` / `openLevel` não existem** como global aqui — são de dashboards adicionais, não deste contexto.
      - **`startApplication` é impostor**: no frame do gadget existe, mas só chama `startAgGrid()` (inicia um grid), não abre tela.
      - **Nova aba do navegador** (`window.open(...#app/<base64>)`) abre a tela MAS **aba nova zera o `sessionStorage`** → cai na **tela de login**. Descartado.
      - **Trocar SÓ o `location.hash`** (sem navegar) com a SPA já carregada **não roteia** — nada acontece. ⚠️ Não confundir com o **Passo 3 da solução final**, que é diferente e **funciona**: navegar a aba inteira (`top.location.href = ...system.jsp#app/<base64>`). A navegação completa recarrega a SPA já no recurso certo e, por ser a **mesma aba**, mantém a sessão (sem login).
      - Caminho `/mge/<resourceID>` (sem `system.jsp#app/`) → *Not Found*.
  - **Deep-link (usado como Passo 3 da solução final):** o Sankhya abre telas pelo formato **`.../mge/system.jsp#app/<base64(resourceID)>`**. Ex.: `btoa("br.com.sankhya.rh.Requisicoes")` = `YnIuY29tLnNhbmtoeWEucmguUmVxdWlzaWNvZXM=`. **Navegar a própria aba** para essa URL (`top.location.href`) carrega o recurso mantendo a sessão. **Não** abrir em aba nova (zera o `sessionStorage` → login).
  - **Implementação no `painel-index.html` (`abrirRequisicoes`) — versão final:** sobe até a janela mais alta acessível (`top`), **varre descendo** por todos os iframes (`document.querySelectorAll('iframe')` → `contentWindow`, recursivo, com dedup de janelas e de objetos `workspace` e guarda contra cross-origin), coleta todo `workspace` e chama, em ordem, `openActivityResourceID` → `openAppActivity` → `openActivity`, cada um com os argumentos `(resourceID)`, `(resourceID, globalID)` e `(globalID)`, retornando na primeira que não lançar. **Não usar nomes genéricos** como `open` na busca por função — colidem com o `window.open` nativo e abrem uma URL relativa errada (`/mge/<id>` → *Not Found*). O deep-link **por caminho** (`/mge/` + id, sem `system.jsp#app/`) **não funciona** — só o formato `system.jsp#app/<base64>`, e mesmo esse foi descartado (aba nova → login; trocar hash → não roteia).
  - **Observação:** a SPA do Sankhya Om **não** lista suas funções como candidatos óbvios; para descobrir a API de um gadget, rodar no console (F12, dentro do iframe do gadget) `Object.keys(window.top)` e procurar nomes como `startApplication`.
- **Robustez:** contexto de gadget pode exigir inicialização **independente de `DOMContentLoaded`** e decodificação **tolerante a UTF-8/ISO-8859-1** nas respostas do serviço (o `painel-index.html` usa `DOMContentLoaded` + `fetch` JSON; ajustar conforme o ambiente).

**Tela de destino do link do sino:** o link do sininho abre esta mesma tela HTML5; o botão "Buscar" consulta os dados via `DbExplorerSP.executeQuery` (query direta, **sem necessidade de um Action Button Java dedicado** — abordagem confirmada com o usuário como suficiente).

## 2. Implantação

1. Aplicar os objetos de banco: view `VW_ALERTA_FERIAS_A_VENCER`, tabela `AD_FERIAS_NOTIFICADO`, tabela `AD_FERIAS_CONFIG` e procedure `STP_NOTIFICA_SISTEMA_CUSTOM`.
2. Publicar a tela HTML5 (componente) no Sankhya.
3. Cadastrar o `.jar` como **Ação Agendada (Java)**, classe `AlertaFeriasNotificacao`, gatilho **CRON diário**.
4. Confirmar a conta de e-mail do DP (`CODCON`/`CODSMTP`) e a permissão de acesso do usuário à tela de destino do drill-through.
5. Homologar com **`MODO_TESTE` ligado**; validado, **desligar para produção**.

## 3. Homologação realizada

Validado no ambiente **`erp-hml`**: pop-up e sininho exibidos ao DP; navegação do sino para o painel; painel com filtros, KPIs, detalhe e drill-through; e-mail por líder e e-mail consolidado ao DP entregues com sucesso pela conta do DP (`STATUS = "Sucesso: Enviada"` na `TMDFMG`), com layout Voke e acentuação corretos.

O cronograma de validação com o key user foi conduzido em **sessões sequenciais** (sem datas fixas): preparação de massa de teste → validação da regra de negócio (quem entra/sai) → validação dos canais → comportamento em produção → aceite formal.

## 4. Estrutura de repositório recomendada (Azure DevOps)

```
alerta-ferias/
  database/
    views/       -> VW_ALERTA_FERIAS_A_VENCER.sql
    procedures/  -> STP_NOTIFICA_SISTEMA_CUSTOM.sql
    tables/      -> AD_FERIAS_NOTIFICADO.sql, AD_FERIAS_CONFIG.sql
  src/
    main/java/br/com/voke/rh/ferias/AlertaFeriasNotificacao.java
  frontend/
    index.html   (componente HTML5 — ver assets/painel-index.html nesta skill)
  docs/
    Alerta_Ferias_a_Vencer.md  (documento consolidado) + POP
  README.md, .gitignore, CHANGELOG.md
```

Fluxo de publicação:

```bash
git init
git add .
git commit -m "Alerta de Ferias a Vencer - solucao completa"
git branch -M main
git remote add origin https://dev.azure.com/{org}/{projeto}/_git/{repo}
git push -u origin main
```

Estratégia de branches:

| Branch | Uso |
|---|---|
| `main` | Versão estável / homologada. Protegida. |
| `develop` | Integração do que está em desenvolvimento. |
| `feature/xxx` | Uma feature ou correção por vez. |

Fluxo típico: `checkout develop` → `pull` → `checkout -b feature/xxx` → alterações → `commit` → `push` → Pull Request para `develop` → revisão → merge. Vincular commits a Work Items do Boards citando `#ID` na mensagem.
