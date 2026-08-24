# Tela HTML5, implantação e homologação

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
  - **⭐ Como abrir outra tela a partir de um gadget HTML5 — a resposta CERTA e confirmada (com `>>> OK` no console do ambiente real):**
    ```js
    // O objeto `workspace` tem o método nativo:
    workspace.openActivityResourceID("br.com.sankhya.rh.Requisicoes");
    ```
    Abre a tela como **aba interna** do workspace, na **mesma sessão**, sem aba de navegador e sem reload.
  - **🎯 O ERRO QUE CUSTOU HORAS — a DIREÇÃO da busca pelo `workspace`:** o objeto `workspace` **NÃO está na cadeia de frames-pai** do gadget. Ele vive num **iframe IRMÃO**, alcançável **DESCENDO** a partir do topo (`top` → `document.querySelectorAll('iframe')` → `contentWindow.workspace`), recursivamente. A primeira versão do `abrirRequisicoes` só **subia** (`window` → `parent` → … → `top`) e por isso achava **0 workspaces** e "não abria nada". A varredura que funciona (mesma do comando de descoberta abaixo) achou **`WORKSPACES: 1`**, com `openActivityResourceID` presente, e a chamada retornou `>>> OK`. **Regra:** para achar `workspace` (ou qualquer API do Sankhya) a partir de um gadget, **desça do `top` por todos os iframes** — nunca confie só em subir a cadeia de pais. O `painel-index.html` faz exatamente isso: sobe até a janela mais alta acessível e então varre **descendo** por todos os iframes, dedup por objeto, e chama `openActivityResourceID(resourceID)` (com fallbacks `openAppActivity`/`openActivity` e argumentos `resourceID` / `resourceID,globalID` / `globalID`).
  - **Como foi descoberto (método reproduzível para qualquer dev):** enumerar os métodos do `workspace` — que são **não-enumeráveis** (classe ES6), então `for..in` não pega; use `getOwnPropertyNames` na cadeia de protótipos. Comando de console (varre todos os iframes a partir do topo, sem trocar de contexto):
    ```js
    (function s(d){[].slice.call(d.querySelectorAll('iframe')).forEach(function(f){try{var w=f.contentWindow,o=w.workspace;if(o){var m=[],p=o;while(p&&p!==Object.prototype){Object.getOwnPropertyNames(p).forEach(function(k){try{if(typeof o[k]==='function'&&m.indexOf(k)<0)m.push(k)}catch(e){}});p=Object.getPrototypeOf(p)}console.log('WS '+(f.src||'').slice(-35)+': '+m.join(', '))}s(w.document)}catch(e){}})})(document)
    ```
    Outros métodos úteis do `workspace` (do ambiente real): `openActivity`, `openAppActivity`, `applicationClick`, `closeTab`, `reloadTab`, `searchApp`, `showMessage`, `callService`, `getTokenLogin`, `logout` etc.
  - **⚠️ Armadilhas que NÃO funcionam** (comprovadas neste dev — não repetir, custaram horas):
      - **`openApp` / `openLevel` não existem** como global aqui — são de dashboards adicionais, não deste contexto.
      - **`startApplication` é impostor**: no frame do gadget existe, mas só chama `startAgGrid()` (inicia um grid), não abre tela.
      - **Nova aba do navegador** (`window.open(...#app/<base64>)`) abre a tela MAS **aba nova zera o `sessionStorage`** → cai na **tela de login**. Descartado.
      - **Trocar `location.hash` com a SPA já carregada** não roteia; **recarregar a aba** fecha o workspace — não é "aba interna". Descartado.
      - Caminho `/mge/<resourceID>` (sem `system.jsp#app/`) → *Not Found*.
  - **Fallback por URL (deep-link):** o Sankhya abre telas pela própria barra de endereço no formato **`.../mge/system.jsp#app/<base64(resourceID)>`**. Ex.: `btoa("br.com.sankhya.rh.Requisicoes")` = `YnIuY29tLnNhbmtoeWEucmguUmVxdWlzaWNvZXM=`. Abrir essa URL (nova aba ou trocando o hash do `window.top`) faz a SPA carregar o recurso. Serve quando `startApplication` não estiver disponível.
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
