# Embutir no Sankhya (Construtor de Telas · componente HTML5)

Esta pasta contém a versão **autossuficiente** da tela de Consulta NF-e —
um único arquivo HTML **sem dependências externas** (sem CDN, sem backend),
pronto para ser colado no **componente HTML5** do Construtor de Telas /
Construtor de Componente do Sankhya (ex.: `[VOKE] Consulta Sefaz`).

## Arquivo

- [`consulta-nfe-standalone.html`](consulta-nfe-standalone.html) — tela completa
  (consulta por chave em modo demo + **leitura de `.zip`/`.xml` no navegador** +
  geração de PDF por impressão).

## Como usar no Sankhya

1. Abra **Construtor de Telas** → seu componente (ex.: código 847 `[VOKE] Consulta Sefaz`).
2. No painel **Componentes**, arraste um controle **HTML5** para a área de design.
3. Cole o conteúdo de `consulta-nfe-standalone.html` no HTML5 (ou aponte a URL,
   caso hospede o arquivo). Como é autossuficiente, funciona dentro do iframe do
   dashboard sem precisar liberar CDNs.
4. Salve e abra a tela. Arraste um `.zip` de XMLs (ou um `.xml`) direto na área
   de upload da tela.

## Por que autossuficiente

O componente HTML5 do Sankhya roda embarcado e pode bloquear scripts externos.
Esta versão lê o `.zip` **nativamente** com a API `DecompressionStream` do
navegador (sem JSZip) e faz o parse do XML com `DOMParser` — nada sai do
navegador do usuário.

> Requer navegador moderno (Chrome/Edge/Firefox recentes) para a descompactação
> nativa do `.zip`. Para PDF, use o botão **Gerar PDF** (impressão → salvar como PDF).

## Teste rápido

Use o arquivo [`../exemplos/notas-exemplo.zip`](../exemplos/notas-exemplo.zip)
(2 notas) para validar o fluxo de importação e a seleção de múltiplas notas.
