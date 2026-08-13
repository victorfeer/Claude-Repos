# Schemas / DTOs principais (VokeNext Low Code API)

Extraído do bloco `definitions` do OpenAPI 2.0 (Swagger). Para o JSON bruto e completo,
ver `references/openapi.json` (paths) — os `definitions` completos ficam melhor
consultados diretamente no Swagger UI publicado do ambiente, pois esse bloco é grande
(~50 schemas); aqui ficam só os que importam para uso prático da API.

---

## Metamodelo (Projeto → Business Object → Business Rule)

### `ProjectApi`
```json
{
  "name": "erp-finance",
  "description": "Finance ERP integration module",
  "uuid": "uuid",
  "version": "1.0.1"
}
```

### `BusinessObjectApi`
```json
{
  "name": "string",
  "businessName": "string",
  "description": "string",
  "type": "TABLE | VIEW",
  "databaseConnectionName": "string",
  "project": "ProjectApi",
  "columns": ["DataColumnApi"],
  "relationships": ["RelationshipApi"],
  "sqls": ["CustomSQL"],
  "uuid": "uuid",
  "version": "1.0.1"
}
```

### `DataColumnApi`
Campos: `name`, `attributeName`, `label`, `type`, `size`, `precision`, `pk` (bool),
`required` (bool), `autoIncrement` (bool), `generatedValue` (bool), `sequenceName`,
`specificSequence` (bool), `databaseType`, `domainKey`, `description`.

`type` (enum) — tipos de coluna suportados:
`INTEGER, LONG, SHORT, FLOAT, DOUBLE, CHARACTER, BYTE, BOOLEAN, STRING, DATE, CALENDAR,
TIMESTAMP, BIG_DECIMAL, BIG_INTEGER, CURRENCY, ECM, BINARY, IMAGE, INSTANCE_ID, ARRAY,
UUID, JSON, TIMESTAMPTZ`

### `RelationshipApi`
Relacionamento entre business objects. `type`: `MANY_TO_ONE` ou `ONE_TO_MANY`.
Campos: `name`, `attributeName`, `label`, `description`, `required`, `referencedObject`
(`BusinessObjectBaseApi`), `referencedColumn` (`DataColumnApi`), `columns`
(`RelationshipColumnApi[]`: `objectColumnName` ↔ `referencedColumnName`).

### `CustomSQL`
SQL customizada anexada a um business object. Campos: `name`, `description`, `sql`,
`type` (`INSERT | UPDATE | DELETE | SELECT`), `defaultSQL` (bool),
`selectQueryPiece`, `fromWhereQueryPiece`, `orderQueryPiece`.

### `BusinessRuleApi`
```json
{
  "name": "string",
  "description": "string",
  "code": "string — código-fonte da regra",
  "type": "DROOLS | FLOW | SCRIPT | NODE",
  "project": "ProjectApi",
  "variables": ["VariableApi"],
  "uuid": "uuid",
  "version": "1.0.1"
}
```

### `VariableApi`
Variável de entrada/saída de uma business rule. Campos: `name`, `description`,
`input`/`output`/`required` (bool), `defaultValue` (`DefaultValueApi`), `type`.

`type` (enum): `BOOLEAN, DATE, INTEGER, LONG, DOUBLE, TEXT, JAVAOBJECT, XML, JSON,
BUSINESSRULE, BUSINESSOBJECT, IMAGE, TABLE, JSONARRAY, SENSITIVE, TEST_AUTOMATION_OUTPUT`

---

## Flows / Integração

### `FlowDTO` / `FlowVersionViewDTO`
Representa um flow (fluxo de integração, regra de negócio, processo de negócio ou
modelagem de dados). Campo relevante: `flowApplication` (enum) —
`BUSINESS_PROCESS | SERVICE_INTEGRATION | BUSINESS_RULE | DATA_MODELING`.
`FlowVersionViewDTO` adiciona `majorVersion`/`minorVersion`, `variables`
(`FlowVariableDTO[]`), `identifier`, `versionAsString`.

### `FlowVariableDTO`
Variável de um flow: `variable` (`VariableDTO`), `input`/`output`/`required`/
`persistentVariable`/`returnVariable`/`statusVariable` (bool), `initialValue`
(`ExpressionDTO`), `index`.

### `ExpressionDTO`
Valor de uma variável: `expressionType` (`CONSTANT | SCRIPT | VARIABLE`),
`constantValue`, `scriptCode` (`ScriptCode`: `engineType` `RHINO|NODE` + `script`),
`flowVariable`.

---

## Autenticação / Configurações do tenant

### `Settings` (retornado por `GET /automations/{tenant-id}/settings`)
```json
{
  "auth": "Oauth2 Settings",
  "agentAuth": "Oauth2 Settings",
  "environment": { "...": "variáveis de ambiente do tenant" },
  "general": "General Settings",
  "mobile": "Mobile Settings"
}
```

### `Oauth2 Settings` — **confirma o modelo de autenticação da API**
```json
{
  "clientId": "string — client_id",
  "clientSecret": "string — client_secret",
  "grantType": "string — grant_type",
  "url": "string — Auth URL"
}
```
Ou seja, a própria API expõe (a nível de configuração de tenant) um objeto padrão
**OAuth2 Client Credentials**: `client_id` + `client_secret` + `grant_type` contra uma
`url` de autenticação. Isso é consistente com o uso de **Keycloak** já confirmado na
integração `voke.jar` (ver skill `sankhya-vokenext-integracao`, DTO `Token` com
`access_token`/`refresh_token`/`session_state`).

### `Tenant`
```json
{
  "id": "string",
  "name": "string",
  "domain": "string",
  "datasource": "TenantDataSource",
  "objectStorage": "TenantObjectStorage",
  "mobileSettings": "Mobile Settings"
}
```

### `TenantDataSource`
`database` (enum: `POSTGRES | SQLSERVER | ORACLE | DB2 | MYSQL`), `jdbcUrl`, `username`,
`password`, `schema`, `pool` (`PoolProperty`: `maximumPoolSize`, `minimumIdle`,
`connectionTimeout`, `idleTimeout`, `initializationFailTimeout`, `leakDetectionThreshold`).

### `TenantObjectStorage`
Config de storage de objetos (S3-like): `endpoint`, `bucket`, `region`, `accessKey`,
`secretKey`, `prefixKey`.

---

## Pacotes (deploy) e diagnóstico

### `PackLogDTO` / `PackLogItem`
Log de import/export de pacote Low Code. `status`/`ddlStatus` (enum: `Done | Error |
Running | Stopped | Not_started`). `items` traz um `PackLogItem` por elemento processado,
com `messageType` (`INFO | SUCCESS | ERROR`) e `element` (`PackElement`).

### `PackElement`
Elemento versionado de um pacote. `type` (enum, extenso):
`IMAGE, JAVA_SCRIPT, CSS, PAGE, FILE, DATA_OBJECT, DDL, BUSINESS_RULE, FORM, FLOW,
BUSINESS_PROCESS, NOTIFICATION, GROUP, APPLICATION, DOMAIN, REPORT, COMPONENT,
PAGE_CONFIG, PARAMETER, LABEL, QUERY_COMPONENT, FAAS, DATA_MODELING, MOBILE_APP`

### `Diagnosis` / `Installation log`
Log de inicialização/erro do tenant. `status` (enum: `None | Initializing | Initialized
| Error`). `step` (enum, extenso) indica em qual fase do provisionamento o erro ocorreu
(ex.: `config_database`, `load_business_object`, `load_form`, `load_report` etc.).

---

## Mobile IDE

### `Schema` (app mobile)
`uuid`, `project`, `name`, `description`, `version`, `time` (timestamp numérico),
`screens` (`Screen[]`).

### `Screen`
`uuid`, `name`, `properties`, `styles`, `version`, `actions` (`Action[]`), `events`
(`Event[]`), `elements` (`ElementDTO[]` — árvore de componentes visuais, cada um com
`className`, `type`, `properties`, `styles`, `children`).

### `ComponentDTO`
Definição de um componente disponível no builder mobile. `category` (enum: `FormInput
| Layout | Request | Custom`), `definitions` (mapa de `ComponentDefinition`).

---

## Genéricos

### `Resource` (retorno de listagens não paginadas)
`filename`, `description`, `file`, `url`, `uri`, `open`/`readable` (bool),
`inputStream`.

### `GridVH` (retorno paginado)
```json
{ "objects": [ /* registros */ ], "totalItens": 0, "totalPages": 0 }
```

### `UserDTO`
`id`, `username`, `name`, `email`, `enabled` (bool), `authorities` (`Role[]`),
`groups` (string[]).
