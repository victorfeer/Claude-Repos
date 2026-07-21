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
3. Abra o gadget dentro do Om — a tela detecta automaticamente
   `DbExplorerSP.executeQuery` e passa a usar os dados reais do seu banco.
   Fora do Sankhya (teste local no navegador), a tela cai sozinha para
   dados fictícios (mock) e mostra um aviso "Modo demonstração".

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
- Fallback para dados mock realistas quando `DbExplorerSP` não está
  disponível (uso fora do Sankhya)

## Limitações conhecidas

- Este ambiente de desenvolvimento não tem acesso ao Oracle do Sankhya —
  os dados "reais" só aparecem quando o gadget roda dentro do Sankhya Om,
  onde o bridge de banco (`DbExplorerSP.executeQuery` ou equivalente)
  existe de fato. A validação com dados oficiais precisa ser feita lá.
- Os domínios de `EVENTO` (TSIRLG) e `SUCESSO` (TSILAC) precisam ser
  confirmados no ambiente real; o código já está preparado para ajuste
  caso o domínio real seja diferente do assumido (`'S'`/`'N'`).

## Se aparecer "Modo demonstração" dentro do próprio Sankhya

Isso significa que o gadget não conseguiu localizar o objeto de
integração com o banco no ambiente real. O código tenta, antes de
desistir (até 4 segundos, verificando a cada 250ms):

- variações comuns de nome (`DbExplorerSP`, `DBExplorerSP`, `DbExplorer`,
  etc.) e de método (`executeQuery`, `execute`, `runQuery`, `query`);
- os escopos `window` do próprio gadget, `window.parent` e `window.top`
  (o Sankhya pode expor o bridge só na janela pai do iframe).

Se mesmo assim não encontrar, o banner "Modo demonstração" mostra um link
**"ver diagnóstico"** que lista, dentro de cada escopo, quais propriedades
existem com nomes parecidos com "db/explorer/sankhya/query/sql" — copie
esse texto (ou tire print) e envie de volta para ajustar o nome/escopo
correto na integração. O mesmo diagnóstico também é logado no console do
navegador (`F12` → Console) ao carregar a tela.
