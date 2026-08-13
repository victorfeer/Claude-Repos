---
name: vokenext-lowcode-api
description: >
  Documentação do contrato REST/Swagger da API Low Code da plataforma VokeNext / 4biz
  Oxygen (basePath /lowcode). Cobre CRUD de projetos, business objects, business rules,
  manipulação genérica de dados (/data/{project}/{business-object}), execução de
  flows/regras/FaaS (/integrations/{name}/...), automação de tenant, Mobile IDE e Web App.
  Use ao integrar, escrever cliente HTTP, montar requisições, ou entender endpoints,
  parâmetros, DTOs ou autenticação dessa API. Gatilhos: "API VokeNext", "Low Code API",
  "swagger vokenext", "lowcode/swagger-ui", "/api/v1/projects",
  "/data/{project}/{business-object}", "business object", "query component", "FaaS".
  NÃO use para o fluxo de negócio já implementado no `voke.jar`
  (skill `sankhya-vokenext-integracao`) — use esta quando for sobre o contrato da API.
---

# API Low Code — VokeNext / 4biz Oxygen

Documentação de referência do contrato **OpenAPI 2.0 (Swagger)** da API Low Code, extraída
do JSON de especificação fornecido pelo usuário (host de homologação:
`vokenex-hom.4bizoxygen.com`, basePath `/lowcode`).

> Esta é a mesma família de API citada na documentação pública do CITSmart/Oxygen como
> "APIs de Low Code (objetos de negócio, entidades personalizadas)", acessível via
> `https://<base_url>/lowcode/swagger-ui.html#/` — ver seção "Autenticação" abaixo para o
> que confirmamos sobre como ela se autentica de fato.

---

## Visão geral

A API é organizada em **9 controllers/tags**:

| Tag | Controller | Propósito |
|---|---|---|
| API for registering projects | Project Api Controller | CRUD do metamodelo: projetos |
| API for registering business objects | Business Object Api Controller | CRUD do metamodelo: objetos de negócio (entidades) |
| API for registering business rules | Business Rule Api Controller | CRUD do metamodelo: regras de negócio |
| API for data manipulation of business objects | Data Controller | **CRUD genérico de dados** de qualquer business object já cadastrado |
| API for resources data | Resources Controller | Busca de flows e suas variáveis |
| API for running FaaS, integration flows and business rules | Integration Controller | **Execução** de flows, regras e funções (FaaS) |
| API for environment automation operations | Automations Controller | Provisionamento/deploy de tenant (datasources, pacotes, settings) |
| API for Mobile IDE | App Metadata Controller | Schemas e telas de apps mobile construídos no Low Code |
| API for Web App | Web App Controller | Renderização de páginas web do Low Code |

Para a lista completa de endpoints com método, path e descrição, **leia
`references/endpoints.md`** — organizado exatamente por esses 9 grupos, com uma tabela
extra de "por caso de uso" no final para achar rápido o endpoint certo.

Para os DTOs (formato de request/response), **leia `references/schemas.md`**.

O JSON bruto da especificação (bloco `paths`) está em `references/openapi.json`, útil se
for gerar código automaticamente (ex.: um cliente HTTP tipado) a partir do contrato.

---

## Padrões da API (valem para (quase) todos os endpoints)

- **Formato:** `consumes`/`produces` = `application/json` (exceto upload de pacote, que é
  `multipart/form-data`, e o endpoint SSE, que produz `text/event-stream`).
- **Respostas de erro padronizadas:** todo endpoint documenta `401 Unauthorized` e
  `403 Forbidden` além dos códigos de sucesso (`200`/`201`/`204`) e, na maioria,
  `404 Not Found`.
- **Filtros dinâmicos por campo:** nos endpoints de `/data/...`, qualquer nome de coluna
  do business object pode ser passado como query param (`?campo=valor`) — tanto como
  filtro simples quanto como parâmetro de bind para SQL customizada.
- **SQL customizada como "endpoint dentro do endpoint":** um business object pode ter
  `CustomSQL`s nomeadas (tipo `SELECT`, `INSERT`, `UPDATE` ou `DELETE`) que são chamadas
  via `/data/{project}/{business-object}/sqls/{sql}` — isso é o mecanismo para expor
  lógica de banco mais complexa que um CRUD simples não cobre.

---

## Autenticação

A especificação **não traz um endpoint de login/token explícito** (não há
`/oauth/token` ou similar nos `paths`), mas o schema `Oauth2 Settings` — retornado por
`GET /automations/{tenant-id}/settings` dentro de `Settings.auth` (e também
`Settings.agentAuth`) — expõe exatamente os quatro campos de um fluxo **OAuth2 Client
Credentials**:

```json
{
  "clientId": "client_id",
  "clientSecret": "client_secret",
  "grantType": "grant_type",
  "url": "Auth URL"
}
```

**Isso confirma, do lado do contrato da API, o que já era conhecido do lado da integração
real:** o `voke.jar` (integração Sankhya ↔ Run2Biz) se autentica via OAuth2/Keycloak,
guardando `client_id`/`client_secret`/URL de token em parâmetros do Sankhya
(`R2BUSER`/`R2BPASSWORD`/`R2BCLIENTSECRET`, `URL_TOKEN_ITSM`) — ver skill
`sankhya-vokenext-integracao` → `references/arquitetura-jar.md`, seção "Autenticação".

Na prática, para consumir esta API a partir de outro sistema:
1. Obtenha `client_id`, `client_secret` e a `url` de autenticação (Keycloak) do ambiente
   — normalmente fornecidos pela Voke/Run2Biz por tenant, não descobertos via API pública.
2. Faça o request OAuth2 client-credentials (ou o grant indicado em `grantType`) contra
   essa `url` para obter um `access_token`.
3. Envie esse token em **todo request subsequente** — pelo padrão de erro (`401`
   "invalid authentication token") já documentado na doc pública do CITSmart, o token vai
   no **header** (tipicamente `Authorization: Bearer <token>`, padrão Keycloak/OAuth2 —
   não confirmado literalmente neste spec Swagger, que omite o header de auth nas
   definições de parâmetros).
4. O `refresh_token` (presente no DTO `Token` da integração `voke.jar`) sugere suporte a
   renovação de sessão sem novo login completo.

> **Lacuna conhecida:** este spec Swagger não documenta explicitamente o header/scheme de
> autenticação (não há `securityDefinitions` no JSON fornecido). Se for implementar um
> cliente novo, valide o header exato testando contra o Swagger UI autenticado do
> ambiente (`/lowcode/swagger-ui.html#/`) antes de assumir `Authorization: Bearer`.

---

## Relação com a integração VokeNext existente (`voke.jar`)

O `voke.jar` consome **duas APIs distintas do mesmo host** — e uma delas **é esta API Low
Code** (`/lowcode`). A lista canônica dos endpoints reais em produção, com o mapeamento de
cada URL para o contrato genérico, está em **`references/uso-real-voke-jar.md`**.

| | Esta API (Low Code) | API ITSM/CMDB |
|---|---|---|
| Base path | `/lowcode` | `/4biz/webmvc` e `/4biz/services` |
| Natureza | Genérica: CRUD de qualquer business object, execução de flows/regras/FaaS | Específica: abertura/avanço de chamado, CMDB de hardware, anexo, comentários |
| Uso pelo `voke.jar` hoje | **Sim** — flows `chamadofilho`/`descricao`/`identificacao` e o BO `FluxosDeAtendimento/Atendimentoesuporteclientelocacao` (emitir NF, data de preparação) | Sim — `search`/`next`/`create`/`updateStatus`/`addAttachments`/`inventory`/`ticket` |

> **Correção de versões anteriores desta skill:** era afirmado que a API Low Code "não é
> referenciada no `voke.jar`" e que a API ITSM ficava em `/citsmart/webmvc`. Ambas estavam
> erradas — a integração **usa** esta API Low Code (ver tabela acima e
> `references/uso-real-voke-jar.md`), e o base path real do ITSM é `/4biz/webmvc` +
> `/4biz/services`.

Ou seja: para **estender** a integração Sankhya↔Run2Biz — ler/gravar um business object do
Low Code ou disparar um flow — **esta é a API a usar**, via
`/data/{project}/{business-object}` ou `/integrations/{name}/flows`, exatamente como o
`voke.jar` já faz nos cinco endpoints mapeados. Já para abrir/avançar chamado, comentar,
anexar ou mexer em CMDB, é a API ITSM (`/4biz/webmvc` · `/4biz/services`), fora do escopo
desta skill — ver `sankhya-vokenext-integracao`.

---

## Exemplo de uso

```bash
# 1. Obter token (fluxo OAuth2 client-credentials — URL/credenciais fornecidas pelo ambiente)
curl -X POST "<auth_url>" \
  -d "grant_type=client_credentials" \
  -d "client_id=<client_id>" \
  -d "client_secret=<client_secret>"

# 2. Listar registros de um business object com filtro e paginação
curl -X GET "https://<host>/lowcode/data/<project>/<business-object>/paged?_filter=status='ABERTO'&_limit=50&_page=0" \
  -H "Authorization: Bearer <access_token>"

# 3. Disparar um flow de integração
curl -X POST "https://<host>/lowcode/integrations/<flow-name>/flows" \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"variavelEntrada": "valor"}'
```

---

## Como navegar esta skill

- **Endpoints reais usados pelo `voke.jar` (com mapeamento)** → `references/uso-real-voke-jar.md`
- **Endpoint específico (método, path, parâmetros)** → `references/endpoints.md`
- **Formato de um DTO (request/response body)** → `references/schemas.md`
- **JSON bruto da spec (para geração de código)** → `references/openapi.json`
