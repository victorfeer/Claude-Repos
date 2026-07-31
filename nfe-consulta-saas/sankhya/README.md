# Embutir no Sankhya (Construtor de Telas · componente HTML5)

Esta pasta contém a versão **autossuficiente** da tela de Consulta NF-e —
um único arquivo HTML **sem dependências externas** (sem CDN), pronto para ser
colado no **componente HTML5** do Construtor de Telas / Construtor de Componente
do Sankhya (ex.: `[VOKE] Consulta Sefaz`).

## Arquivo

- [`consulta-nfe-standalone.html`](consulta-nfe-standalone.html) — tela completa:
  informar a **chave de acesso** → **consultar** a nota → **baixar PDF e XML**.

## Pacote para o componente HTML5

O componente HTML5 do Sankhya carrega um **app web** e pede um **"Ponto de
Entrada"** — o arquivo principal a ser aberto. Por isso o pacote precisa conter
um arquivo chamado **`index.html`** na raiz.

- [`consulta-nfe-sankhya.zip`](consulta-nfe-sankhya.zip) — **este é o pacote do
  app** (contém `index.html`). É este zip que você sobe no componente HTML5.

> ⚠️ Não confunda com um zip de **XMLs** (dados). Aquele não tem `index.html` e,
> por isso, o componente não exibe nada.

## Como usar no Sankhya

1. Abra **Construtor de Componentes** → `[VOKE] Consulta Sefaz` → componente **HTML5**.
2. Faça upload de **`consulta-nfe-sankhya.zip`**.
3. Em **Configurar Componente HTML5 → Ponto de Entrada**, informe/selecione
   **`index.html`**.
4. Aplique e abra a tela. Ela é autossuficiente (sem CDN) e roda no iframe do
   dashboard. Em modo demo, digite qualquer chave de 44 dígitos para ver o layout.

## Consulta real (SEFAZ / Sankhya)

O navegador **não acessa a SEFAZ diretamente** — a SEFAZ exige **certificado
digital** (A1/A3) e bloqueia chamadas de browser (CORS). A consulta real precisa
passar por um **backend** que:

- autentica na SEFAZ com o certificado da empresa **e/ou**
- lê o XML autorizado já armazenado no **Sankhya** (fonte mais rápida, pois a
  nota emitida contra a empresa já está no ERP).

No arquivo, ajuste a constante:

```js
const API = { baseUrl: "https://api.suaempresa.com.br", tokenKey: "nfe_jwt" };
```

Com `baseUrl` vazio, a tela opera em **modo demonstração** (dados de exemplo),
útil para validar layout, consulta por chave e os botões de download.

## Downloads

- **Baixar PDF** — usa a impressão do navegador (Ctrl+P → Salvar como PDF).
- **Baixar XML** — salva o XML autorizado retornado pela consulta.
