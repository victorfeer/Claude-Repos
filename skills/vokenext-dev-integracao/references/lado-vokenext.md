# Lado VokeNext: desenvolvimento e handshake de contrato

A integração tem **dois donos**. Muita mudança "do Sankhya" só funciona se algo do lado VokeNext
existir com o nome e formato certos. Este arquivo cobre o que mora do lado de lá e como coordenar.

## O que o VokeNext controla

- **Flows e flow actions (Run2Biz / ITSM).** As transições que o Run2Biz aceita para um chamado. O
  nome do flow action é um **contrato textual** — grafia divergente = transição recusada (ver bug
  P1.5). Quem define/renomeia flow action é o time VokeNext; o Java só o invoca.
- **CMDB (business objects e campos).** Hardware, Empresa, Contrato e demais itens de configuração. Um
  campo novo no payload de CMDB só "cola" se o business object do lado VokeNext tiver aquele campo.
- **Contrato da Low Code API.** Rotas, DTOs, parâmetros, autenticação (OAuth2 client-credentials,
  basePath `/lowcode`). O detalhe cru desse contrato vive na skill **`vokenext-lowcode-api`** — delegue
  a ela em vez de reproduzir aqui.

## Handshake de contrato (antes de codar o lado Sankhya)

Quando a mudança depende de algo que o VokeNext controla, siga este handshake **antes** de escrever o
código que assume o contrato:

1. **Nomeie a dependência explicitamente.** Ex.: "isto precisa do flow action `X`", "isto grava o
   campo `Y` no business object `Z` do CMDB", "isto chama o endpoint `/data/{proj}/{bo}` com o corpo
   tal".
2. **Marque como "a confirmar com o time VokeNext".** Não invente nome de flow action nem de campo de
   CMDB por dedução — grafia e formato têm que vir deles.
3. **Registre o formato acordado** (nome exato, tipo, obrigatoriedade, exemplo de payload) no
   levantamento de requisitos, para o código nascer alinhado.
4. **Centralize a constante** no Java (nada de string literal de flow action espalhada) para que uma
   futura renomeação seja um ponto só.

Se o usuário for o próprio dono dos dois lados, o handshake vira uma confirmação rápida — mas ainda
assim registre o contrato acordado, porque é ele que o código passa a assumir.

## Modelagem do lado VokeNext (quando a mudança começa por lá)

Se a evolução nasce do lado VokeNext (novo campo de CMDB, novo flow, nova regra/FaaS), aplique o mesmo
fluxo do `SKILL.md`: requisitos → diagramas → validação → implementação. Pontos de atenção:

- **CMDB:** um campo novo precisa existir no business object antes de o Sankhya tentar gravá-lo;
  combine tipo e obrigatoriedade para não quebrar o payload.
- **Flow / flow action:** ao criar/renomear, propague a grafia exata para o Java (constante central) e
  para o levantamento; teste a transição ponta a ponta.
- **Regras / FaaS / query components:** para o *como* (rotas, execução de flow/regra/FaaS, manipulação
  genérica de dados `/data/{project}/{business-object}`), use **`vokenext-lowcode-api`**.

## Divisão de responsabilidade entre skills

- **Esta skill** situa *quando* e *por que* tocar o contrato, e coordena o handshake.
- **`vokenext-lowcode-api`** tem o *detalhe* do contrato REST/Swagger (rotas, DTOs, auth).
- **`sankhya-vokenext-integracao` / `sankhya-integracao-vokenext`** têm o *conhecimento do fluxo* e o
  diagnóstico de incidente pontual.
