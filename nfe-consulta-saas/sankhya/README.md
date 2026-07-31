# Embutir no Sankhya (Construtor de Telas · componente HTML5)

Esta pasta contém a versão **autossuficiente** da tela de Consulta NF-e —
um único arquivo HTML **sem dependências externas** (sem CDN), pronto para ser
colado no **componente HTML5** do Construtor de Telas / Construtor de Componente
do Sankhya (ex.: `[VOKE] Consulta Sefaz`).

## Arquivo

- [`consulta-nfe-standalone.html`](consulta-nfe-standalone.html) — tela completa:
  informar a **chave de acesso** → **consultar** a nota → **baixar PDF e XML**.

## Como usar no Sankhya

1. Abra **Construtor de Telas** → seu componente (ex.: `[VOKE] Consulta Sefaz`).
2. No painel **Componentes**, arraste um controle **HTML5** para a área de design.
3. Cole o conteúdo de `consulta-nfe-standalone.html` no HTML5 (ou aponte a URL,
   caso hospede o arquivo). Como é autossuficiente, funciona no iframe do
   dashboard sem precisar liberar CDNs.
4. Salve e abra a tela.

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
