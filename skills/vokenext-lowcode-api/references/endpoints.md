# Endpoints da API Low Code (VokeNext / 4biz Oxygen)

> Host de homologação observado no spec: `vokenex-hom.4bizoxygen.com`
> Base path: `/lowcode`
> URL completa de um endpoint = `https://<host>/lowcode<path>`
> Todos os endpoints retornam `401 Unauthorized` (token ausente/inválido) ou `403 Forbidden`
> (sem permissão) — ver `SKILL.md` seção Autenticação.

Convenção de nomenclatura: `{param}` é um path param; parâmetros de query estão listados
como `?nome=...`. Corpo de requisição em JSON, salvo indicação contrária.

---

## 1. Projetos (`API for registering projects`)

CRUD de **projetos** — a unidade que agrupa business objects e business rules no Low Code.

| Método | Path | Descrição |
|---|---|---|
| GET | `/api/v1/projects` | Lista todos os projetos |
| POST | `/api/v1/projects` | Cria um novo projeto (body: `ProjectApi`) |
| GET | `/api/v1/projects/{name}` | Retorna um projeto pelo nome |
| PUT | `/api/v1/projects/{name}` | Atualiza um projeto existente |
| DELETE | `/api/v1/projects/{name}` | Remove um projeto |

---

## 2. Business Objects (`API for registering business objects`)

CRUD de **objetos de negócio** (entidades/tabelas) dentro de um projeto.

| Método | Path | Descrição |
|---|---|---|
| GET | `/api/v1/projects/{project-name}/business-objects` | Lista todos os business objects do projeto |
| POST | `/api/v1/projects/{project-name}/business-objects` | Cria um novo business object (body: `BusinessObjectApi`) |
| GET | `/api/v1/projects/{project-name}/business-objects/{business-name}` | Retorna um business object pelo nome de negócio |
| PUT | `/api/v1/projects/{project-name}/business-objects/{business-name}` | Atualiza um business object existente |
| DELETE | `/api/v1/projects/{project-name}/business-objects/{business-name}` | Remove um business object |

---

## 3. Business Rules (`API for registering business rules`)

CRUD de **regras de negócio** (código executável: Drools, Flow, Script ou Node) dentro de um projeto.

| Método | Path | Descrição |
|---|---|---|
| GET | `/api/v1/projects/{project-name}/business-rules` | Lista todas as regras de negócio do projeto |
| POST | `/api/v1/projects/{project-name}/business-rules` | Cria uma nova regra de negócio (body: `BusinessRuleApi`) |
| GET | `/api/v1/projects/{project-name}/business-rules/{name}` | Retorna uma regra pelo nome |
| PUT | `/api/v1/projects/{project-name}/business-rules/{name}` | Atualiza uma regra existente |
| DELETE | `/api/v1/projects/{project-name}/business-rules/{name}` | Remove uma regra |

---

## 4. Manipulação de dados (`API for data manipulation of business objects`)

O núcleo da API: **CRUD genérico de registros** de qualquer business object já cadastrado,
além de execução de SQLs customizadas e consulta de "query components" (consultas prontas).

| Método | Path | Descrição |
|---|---|---|
| GET | `/data/{project}/{business-object}` | Lista registros do business object (suporta filtros — ver query params abaixo) |
| POST | `/data/{project}/{business-object}` | Cria um novo registro |
| GET | `/data/{project}/{business-object}/paged` | Lista registros em formato paginado (`GridVH`: `objects`, `totalItens`, `totalPages`) |
| GET | `/data/{project}/{business-object}/sqls/{sql}` | Executa uma SQL customizada do tipo SELECT já configurada no business object |
| POST | `/data/{project}/{business-object}/sqls/{sql}` | Executa uma SQL customizada do tipo UPDATE/DELETE |
| GET | `/data/{project}/{business-object}/sse` | Stream de dados via **Server-Sent Events** (parâmetro `batch-size`, default 100) |
| GET | `/data/{project}/{business-object}/{pk}` | Busca um registro pela chave primária (suporta múltiplos valores de PK) |
| PUT | `/data/{project}/{business-object}/{pk}` | Atualiza um registro pela chave primária |
| DELETE | `/data/{project}/{business-object}/{pk}` | Remove um registro pela chave primária |
| GET | `/data/{project}/{query-component}/lookups` | Retorna dados de um query component em formato lookup (combo/autocomplete) |
| GET | `/data/{project}/{query-component}/queries` | Retorna dados de um query component |

### Query params comuns nos endpoints de listagem/consulta

| Param | Tipo | Descrição |
|---|---|---|
| `_dir` | string | Direção da ordenação: `asc` ou `desc` (default asc) |
| `_embed` | boolean | Inclui objetos relacionados do tipo N→1 |
| `_expand` | boolean | Inclui objetos relacionados do tipo 1→N |
| `_field` | string[] | Lista de campos a retornar (repetível) |
| `_filter` | string | Cláusula no formato SQL `WHERE` (não pode ser usado junto com `_search`) |
| `_limit` | número | Registros por página |
| `_page` | número | Página desejada (0..N) |
| `_search` | string | Palavra-chave para filtrar campos string (não pode ser usado junto com `_filter`) |
| `_sort` | string[] | Critério de ordenação `campo(,asc\|desc)` (repetível) |
| `_sql` | string | Nome da SQL customizada usada na consulta |
| `{{campo}}` | qualquer | Qualquer nome de campo do objeto pode ser passado como `?campo=valor` para filtrar ou como parâmetro de bind em SQL customizada |

**Exemplo de chamada:**
```
GET /lowcode/data/erp-finance/pedidos?_filter=status='ABERTO'&_sort=dataCriacao,desc&_limit=50&_page=0
```

---

## 5. Fluxos e integrações (`API for resources data` + `API for running FaaS...`)

Execução de **flows** (fluxos de integração/orquestração), **regras de negócio** e
**FaaS** (Function as a Service) já cadastrados na plataforma.

| Método | Path | Descrição |
|---|---|---|
| GET | `/flows` | Busca flows por nome ou descrição (`?value=...`) |
| GET | `/flows/{name}/variables` | Lista as variáveis (input/output) de um flow |
| POST | `/integrations/{name}/flows` | **Executa** um Integration Flow (body: mapa de variáveis) |
| POST | `/integrations/{name}/rules` | **Executa** uma Business Rule (body: mapa de variáveis) |
| POST | `/integrations/{name}/faas` | **Executa** uma FaaS (body: input livre) |

Esses três endpoints de execução (`/integrations/...`) são os pontos de entrada para
disparar processamento server-side a partir de um sistema externo — é o padrão equivalente
ao que o `voke.jar` faz manualmente via chamadas HTTP diretas ao invés de consumir essa API
de forma nativa (ver `SKILL.md`, seção "Relação com a integração VokeNext existente").

---

## 6. Automação de ambiente / tenant (`API for environment automation operations`)

Endpoints administrativos, tipicamente usados por scripts de deploy/CI-CD, não por
integrações de negócio do dia a dia.

| Método | Path | Descrição |
|---|---|---|
| GET | `/automations/{tenant-id}/connections` | Lista datasources JNDI dinâmicos do tenant |
| POST | `/automations/{tenant-id}/connections` | Cria/atualiza datasources JNDI dinâmicos |
| GET | `/automations/{tenant-id}/database-connections` | Lista conexões de banco do tenant |
| POST | `/automations/{tenant-id}/database-connections` | Cria uma conexão de banco |
| PUT | `/automations/{tenant-id}/database-connections/{id}` | Atualiza uma conexão de banco |
| DELETE | `/automations/{tenant-id}/database-connections/{id}` | Remove uma conexão de banco |
| GET | `/automations/{tenant-id}/diagnosis` | Log de diagnóstico de erro no upload da aplicação |
| POST | `/automations/{tenant-id}/initialize` | Inicializa banco de dados e recursos do tenant |
| GET | `/automations/{tenant-id}/packages` | Exporta um pacote Low Code (`?package-name=...`) |
| POST | `/automations/{tenant-id}/packages` | Importa um pacote Low Code (multipart/form-data, campo `file`) |
| GET | `/automations/{tenant-id}/packages/{package-uuid}/logs` | Log de importação de um pacote |
| GET | `/automations/{tenant-id}/settings` | Retorna as configurações do sistema (`Settings`, inclui credenciais OAuth2) |
| PUT | `/automations/{tenant-id}/settings` | Atualiza as configurações do sistema |

---

## 7. Mobile IDE (`API for Mobile IDE`)

Endpoints usados pelo **construtor de aplicações mobile** (schemas de telas, componentes).

| Método | Path | Descrição |
|---|---|---|
| GET | `/app-metadata/definitions` | Lista as definições de componentes disponíveis para montar apps mobile |
| GET | `/app-metadata/schemas` | Busca schemas de app mobile por nome (`?name=...`) |
| POST | `/app-metadata/schemas` | Cria o schema de um novo app mobile |
| GET | `/app-metadata/schemas/{uuid}` | Retorna os dados de um schema |
| PUT | `/app-metadata/schemas/{uuid}` | Atualiza um schema |
| DELETE | `/app-metadata/schemas/{uuid}` | Remove um schema |
| POST | `/app-metadata/schemas/{uuid}/screens` | Cria uma tela dentro do schema |
| GET | `/app-metadata/schemas/{uuid}/screens/{screen-uuid}` | Retorna os dados de uma tela |
| PUT | `/app-metadata/schemas/{uuid}/screens/{screen-uuid}` | Atualiza uma tela |
| DELETE | `/app-metadata/schemas/{uuid}/screens/{screen-uuid}` | Remove uma tela |

---

## 8. Web App (`API for Web App`)

| Método | Path | Descrição |
|---|---|---|
| GET | `/web-app/{page-name}` | Renderiza uma página web (aceita `?model=...` como contexto de dados) |

---

## Tabela de referência rápida por caso de uso

| Você quer... | Use |
|---|---|
| Ler/gravar dados de uma entidade de negócio | `/data/{project}/{business-object}` |
| Consultar um relatório/consulta pronta | `/data/{project}/{query-component}/queries` ou `/lookups` |
| Disparar um fluxo de integração já configurado | `POST /integrations/{name}/flows` |
| Rodar uma regra de negócio isolada | `POST /integrations/{name}/rules` |
| Rodar uma função serverless (FaaS) | `POST /integrations/{name}/faas` |
| Criar/gerenciar a estrutura de um projeto (metamodelo) | `/api/v1/projects/...` |
| Ler/gravar a definição de um objeto de negócio (metamodelo) | `/api/v1/projects/{project-name}/business-objects/...` |
| Exportar/importar um pacote de configuração | `/automations/{tenant-id}/packages` |
