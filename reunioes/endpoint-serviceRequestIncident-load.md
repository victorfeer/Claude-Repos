# Endpoint `serviceRequestIncident.load` — parâmetros e retorno observados

> Documentado a partir da requisição enviada e da resposta observada (Postman: `200 OK`, ~22,69 KB, 204 ms).
> **Conclusão principal:** este endpoint **carrega a tela** (HTML AngularJS do ITSM `/4biz`); ele **não** retorna
> os dados do chamado em formato estruturado. Os campos "retornados" abaixo são o *bootstrap da sessão*, não o ticket 6908.
> Credenciais de acesso omitidas por segurança.

## Requisição

| Item | Valor |
|---|---|
| Método | `POST` |
| URL | `https://vokenex-hom.4bizoxygen.com/4biz/serviceRequestIncident/serviceRequestIncident.load` |
| API | CITSmart / ITSM (`/4biz` webmvc) — **fora** do Swagger da API Low Code (`/lowcode`) |

### Headers necessários
- `Accept: application/json`
- `Content-Type: application/json`
- Cabeçalhos de autenticação da sessão (omitidos)

### Parâmetros do corpo (body JSON)
Todos dentro do objeto raiz `object`:

| Parâmetro | Tipo | Exemplo | Observação |
|---|---|---|---|
| `object.id` | inteiro | `6908` | ID do chamado alvo |
| `object.idContrato` | inteiro | `6` | Contrato (6 = "PAGUE MENOS") |
| `object.nomeServico` | string | `"Atendimento e Suporte Cliente Locação"` | Nome do serviço |

> Observação: no comportamento observado, esses parâmetros **não filtraram o retorno** — a resposta
> não trouxe o chamado 6908, e sim a tela + contexto do usuário logado. Ou seja, para consumo de dados
> eles são efetivamente ignorados por este endpoint.

## Resposta observada (`200 OK`)

Corpo = documento **HTML** da aplicação (`ng-app="serviceRequestIncident"`). Os únicos dados estruturados
embutidos são o contexto de sessão (`USER_LOGGED`) e a config Low Code (`LOWCODE_CONFIG`).

### Campos retornados em `USER_LOGGED`
| Campo | Tipo | Exemplo observado |
|---|---|---|
| `idUsuario` | inteiro | `3072` |
| `idUnidade` | inteiro | `1` |
| `idEmpregado` | inteiro | `3072` |
| `idPerfilAcessoUsuario` | inteiro[] | `[46, 47]` |
| `idEmpresa` | inteiro | `1` |
| `login` | string | `admin.vokenex-hom` |
| `nomeUsuario` | string | `admin vokenex-hom` |
| `status` | string | `A` |
| `email` | string | `admin.vokenex-hom@run2biz.com` |
| `grupos` | string[] | siglas dos grupos (ex.: `1001784`, `ACIO184`, `MONI689`...) |
| `colGrupos` | objeto[] | ver estrutura abaixo |
| `contratos` | inteiro[] | `[2, 3, 6, 7]` |
| `colContratos` | objeto[] | ver estrutura abaixo |
| `fromToken` | boolean | `false` |
| `passwordChanged` | boolean | `false` |

#### Estrutura de `colGrupos[]`
| Campo | Tipo | Exemplo |
|---|---|---|
| `idGrupo` | inteiro | `637` |
| `nome` | string | `Acompanhamento de Chamados Pai` |
| `sigla` | string | `ACOM166` |
| `serviceDesk` | string (S/N) | `S` |

#### Estrutura de `colContratos[]`
| Campo | Tipo | Exemplo |
|---|---|---|
| `idContrato` | inteiro | `6` |
| `idCliente` | inteiro | `6` |
| `numero` | string | `PAGUE MENOS` |
| `dataContrato` | data | `Dec 3, 2025` |
| `dataFimContrato` | data | `Dec 3, 2026` |
| `tipo` | string | `C` |
| `situacao` | string | `A` |
| `idMoeda` | inteiro | `1` |
| `idFornecedor` | inteiro | `3` |

### Campos retornados em `LOWCODE_CONFIG`
| Campo | Valor observado |
|---|---|
| `username` | `admin.vokenex-hom` |
| `authenticated` | `true` |
| `enabled` | `true` |
| `url` / `context` | `/lowcode` |
| `external` | `true` |

### Outras variáveis globais no retorno
`URL_SISTEMA=/4biz/`, `LOCALE_SISTEMA=en`, `VERSAO_SISTEMA=1.9.24.2`, `HYP_BASENAME=/workflow`,
`HYP_KANBAN_INT_ENABLED=true`, `_TIME_ZONE=America/Sao_Paulo`.

## Resumo
- **Recebe:** `object.{id, idContrato, nomeServico}` + cabeçalhos de autenticação da sessão.
- **Retorna:** HTML da tela + contexto de sessão (`USER_LOGGED`, `LOWCODE_CONFIG`). **Não retorna o chamado.**
- **Para obter o chamado em formato estruturado:** usar a busca interna da tela (DevTools → Network ao clicar "Pesquisar")
  ou a API Low Code `GET /lowcode/data/{project}/{business-object}` com filtros.
