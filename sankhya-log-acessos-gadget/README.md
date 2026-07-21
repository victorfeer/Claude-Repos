# Gadget — Log de Acessos Sankhya (Voke)

Gadget HTML5 único (`index.html`) para rodar dentro do Sankhya Om via
iframe, exibindo o log de acessos dos usuários (sessões de login + eventos
detalhados por tela/programa) dos últimos meses, com a identidade visual
da Voke.

## Arquivos

| Arquivo | Descrição |
|---|---|
| `index.html` | Gadget completo — HTML + CSS + JS inline, sem dependências externas (exceto a fonte Poppins do Google Fonts) |

O Sankhya exige que o arquivo principal do gadget se chame exatamente
`index.html` e fique na **raiz** do zip enviado (sem subpastas).

## Como instalar no Sankhya

1. Compacte `index.html` em um `.zip`, garantindo que ele fique na raiz do
   arquivo (não dentro de uma subpasta).
2. Suba o zip como gadget HTML5 no Sankhya Om.
3. Abra o gadget dentro do Om — a tela chama o serviço MGE do Sankhya
   (`POST /mge/service.sbr?serviceName=DbExplorerSP.executeQuery`, mesmo
   endpoint usado pelo gadget "Alerta de Férias a Vencer" da Voke) e passa
   a usar os dados reais do seu banco. Fora do Sankhya (teste local no
   navegador), o fetch falha e a tela cai sozinha para dados fictícios
   (mock), mostrando um aviso "Modo demonstração" com o motivo do erro.

## Fontes de dados / consultas

O gadget roda **3 SELECTs independentes** (nenhuma subquery aninhada
combinando tudo numa chamada só), cada um com uma responsabilidade:

### Query A — Sessões de login (`TSIRLG`)
Alimenta a tabela "Sessões de login". Uma linha por sessão (login/logout).

```sql
SELECT rlg.CODUSU, usu.NOMEUSU AS NOME_USUARIO,
       rlg.LOGIN AS DH_LOGIN, rlg.LOGOUT AS DH_LOGOUT,
       ROUND((rlg.LOGOUT - rlg.LOGIN) * 24 * 60, 1) AS DURACAO_MIN,
       rlg.IP, rlg.AGENTE AS NAVEGADOR, rlg.SESSIONID, rlg.EVENTO, rlg.SEQACESSO
FROM   TSIRLG rlg
LEFT JOIN TSIUSU usu ON usu.CODUSU = rlg.CODUSU
WHERE  rlg.LOGIN >= ADD_MONTHS(SYSDATE, -18)
ORDER BY rlg.LOGIN DESC
```

- `LOGOUT` pode vir nulo (sessão que não encerrou direito) → a tela mostra
  "em aberto" e não calcula duração.
- `EVENTO` tem domínio ainda não mapeado no ambiente; vai no SELECT só para
  inspeção, não é usado para filtrar nada.

### Query B — Eventos de acesso detalhados (`TSILAC`)
Alimenta a tabela "Eventos de acesso detalhados". **Carregada sob
demanda** (botão "Carregar eventos detalhados"), porque 18 meses de
TSILAC tende a ser o volume mais pesado das três consultas.

```sql
SELECT lac.USUARIO, usu.NOMEUSU AS NOME_USUARIO, lac.DHACESSO, lac.MODULO,
       lac.PROGRAMA, lac.CODPROD, lac.SUCESSO, lac.IP, lac.HOSTNAME,
       lac.TERMINAL, lac.VERSAOEXE, lac.SID
FROM   TSILAC lac
LEFT JOIN TSIUSU usu ON usu.NOMEUSU = lac.USUARIO
WHERE  lac.DHACESSO >= ADD_MONTHS(SYSDATE, -18)
ORDER BY lac.DHACESSO DESC
```

- `SUCESSO`: `'S'` = sucesso / `'N'` = falha — **confirmar o domínio real**
  no ambiente antes de confiar no badge Sucesso/Falha da tela.
- O `LEFT JOIN` assume que `TSILAC.USUARIO` (texto, login) casa com
  `TSIUSU.NOMEUSU` — validar no seu banco; se não bater, a tela cai
  automaticamente para exibir o próprio `USUARIO` (login).

### Bônus — Resumo agregado por usuário/mês (`TSIRLG`)
Substitui uma consulta de KPI com subqueries correlacionadas (mais
pesada) por um único `GROUP BY`, leve, usado para calcular os KPIs
**Total de acessos**, **Usuários ativos** e **Duração média**.

```sql
SELECT usu.NOMEUSU AS NOME_USUARIO,
       TO_CHAR(rlg.LOGIN, 'YYYY-MM') AS MES,
       COUNT(*) AS QTD_ACESSOS,
       ROUND(AVG((rlg.LOGOUT - rlg.LOGIN) * 24 * 60), 1) AS DURACAO_MEDIA_MIN
FROM   TSIRLG rlg
LEFT JOIN TSIUSU usu ON usu.CODUSU = rlg.CODUSU
WHERE  rlg.LOGIN >= ADD_MONTHS(SYSDATE, -18)
GROUP BY usu.NOMEUSU, TO_CHAR(rlg.LOGIN, 'YYYY-MM')
ORDER BY MES DESC, QTD_ACESSOS DESC
```

O KPI **Acessos com falha** depende da Query B (TSILAC) e por isso só é
calculado depois que os eventos detalhados forem carregados — até lá o
card mostra um link "carregue os eventos detalhados" no lugar do número.

> Todas as três aceitam o período em meses como parâmetro
> (`ADD_MONTHS(SYSDATE, -N)`), controlado pelo seletor "Período" no topo
> da tela (18 / 6 / 3 / 1 mês).

## Funcionalidades da tela

- Header com identidade visual Voke (azul marinho, círculos rosa
  decorativos, tipografia Poppins)
- Busca por usuário ou IP, filtrando as duas tabelas ao vivo (client-side)
- Seletor de período (recarrega Query A + Bônus; zera o estado da Query B)
- 4 cards de KPI (Total de acessos, Usuários ativos, Duração média,
  Acessos com falha)
- Tabela de sessões de login, sempre carregada
- Tabela de eventos detalhados, carregada sob demanda (botão + aviso de
  volume), com badge Sucesso/Falha
- **Paginação de 10 registros por página** em ambas as tabelas, com
  botões "Anterior"/"Próxima" e contador "Página X de Y · N registros"
  (independente por tabela; volta para a página 1 ao buscar, trocar
  período ou recarregar os eventos)
- Exportação CSV (BOM `﻿`, separador `;`, sanitização contra
  injeção de fórmula prefixando `'` em células iniciadas com `= + - @`)
- Fallback para dados mock realistas quando o serviço MGE não responde
  (uso fora do Sankhya, ou erro real do endpoint)

## Integração com o banco

Igual ao gadget "Alerta de Férias a Vencer" da Voke, a leitura do banco
não usa nenhum objeto JS global (tipo `window.DbExplorerSP`) — é uma
chamada HTTP direta ao serviço MGE do próprio Sankhya:

```js
POST /mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json
Content-Type: application/json

{ "serviceName": "DbExplorerSP.executeQuery", "requestBody": { "sql": "<SELECT...>" } }
```

A resposta vem em `responseBody.fieldsMetadata` (nomes das colunas) +
`responseBody.rows` (array de arrays, na mesma ordem das colunas). O
código já trata dois detalhes conhecidos desse endpoint:

- alguns servidores devolvem o corpo em ISO-8859-1 mesmo com o header
  dizendo UTF-8 (acentos quebrados) — o gadget tenta decodificar como
  UTF-8 estrito primeiro e refaz como ISO-8859-1 se falhar;
- `json.status !== "1"` indica erro do lado do servidor — a mensagem
  (`json.statusMessage`) sobe direto pro banner "Modo demonstração", então
  qualquer erro real (SQL, permissão, etc.) aparece com o texto original
  do Sankhya, não um "não detectado" genérico.

## Limitações conhecidas

- Este ambiente de desenvolvimento não tem acesso ao Oracle do Sankhya —
  os dados "reais" só aparecem quando o gadget roda dentro do Sankhya Om,
  batendo no `/mge/service.sbr` de verdade. A validação com dados oficiais
  precisa ser feita lá.
- Os domínios de `EVENTO` (TSIRLG) e `SUCESSO` (TSILAC) precisam ser
  confirmados no ambiente real; o código já está preparado para ajuste
  caso o domínio real seja diferente do assumido (`'S'`/`'N'`).

## Se aparecer "Modo demonstração" dentro do próprio Sankhya

O banner mostra a mensagem de erro real (ex.: `HTTP 404`, `HTTP 401`, ou o
`statusMessage` retornado pelo Sankhya) — copie esse texto e me mande para
eu ajustar o endpoint ou a query. Causas prováveis:

- o prefixo do serviço MGE é diferente de `/mge/service.sbr` neste
  ambiente (alguns Sankhya publicam em outro path/porta);
- o usuário logado no gadget não tem permissão para `DbExplorerSP`;
- alguma das 3 queries tem um erro de sintaxe/coluna que só aparece no
  banco real (o `statusMessage` do Oracle costuma indicar exatamente qual).
