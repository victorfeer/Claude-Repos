# Endpoints realmente usados pela integração Sankhya ↔ Run2Biz (`voke.jar`)

> Fonte: enum de URLs da integração (`Requisicoes`, no `voke.jar`). Ao contrário do que uma
> leitura do Swagger sozinho sugeria, **a integração usa DUAS APIs distintas do mesmo host**
> — e uma delas *é* esta API Low Code (`/lowcode`). Esta é a lista canônica do que está em
> produção hoje, com o mapeamento de cada URL real para o contrato genérico documentado em
> `endpoints.md`.

O host é o mesmo (`4bizoxygen.com`), mas há **dois base paths**:

| Base path | API | Coberta por esta skill? |
|---|---|---|
| `/lowcode` | **API Low Code** (business objects + flows/FaaS) | ✅ Sim — é o assunto desta skill |
| `/4biz/webmvc` e `/4biz/services` | **API ITSM/CMDB** (chamados, CMDB, anexos) — a "webmvc" do CITSmart/4biz | ❌ Não — API diferente, específica de ITSM |

> Correção importante: versões anteriores desta skill diziam que a API Low Code "não é
> referenciada no `voke.jar`" e que o ITSM ficava em `/citsmart/webmvc`. Ambas as
> afirmações estavam erradas. O base path real do ITSM é `/4biz/webmvc` (+ `/4biz/services`),
> e a API Low Code **é** consumida pela integração — nos cinco endpoints da tabela abaixo.

---

## Parte A — Endpoints `/lowcode` (ESTA API)

Estes cinco caem no contrato desta skill. Cada linha mostra a constante do enum, a URL real
e a que padrão genérico de `endpoints.md` corresponde.

| Constante | URL real | Padrão genérico | O que faz |
|---|---|---|---|
| `BUSCAR_ID_CHAMADO_FILHO` | `lowcode/integrations/chamadofilho/flows` | `POST /integrations/{name}/flows` (`name=chamadofilho`) | Executa o flow **chamadofilho** para descobrir o id do chamado filho vinculado |
| `ALTERAR_DESCRICAO` | `lowcode/integrations/descricao/flows` | `POST /integrations/{name}/flows` (`name=descricao`) | Executa o flow **descricao** para alterar a descrição do chamado |
| `BUSCAR_HARDWARE` | `lowcode/integrations/identificacao/flows` | `POST /integrations/{name}/flows` (`name=identificacao`) | Executa o flow **identificacao** para buscar dados de hardware/identificação (CMDB) |
| `INSERE_NF` | `lowcode/data/FluxosDeAtendimento/Atendimentoesuporteclientelocacao/` | `/data/{project}/{business-object}/{pk}` (`project=FluxosDeAtendimento`, `business-object=Atendimentoesuporteclientelocacao`) | Grava/atualiza o registro do chamado no BO de locação — usado para **emitir/anexar a NF** |
| `ATUALIZAR_DADOS_LOCACAO` | `lowcode/data/FluxosDeAtendimento/Atendimentoesuporteclientelocacao/` | `PUT /data/{project}/{business-object}/{pk}` (mesmo BO acima) | **US "Data de Preparação" (Alternativa 2):** PUT no mesmo BO, recebe o `{id}` do chamado no fim da URL e atualiza campos do formulário (ex.: `data_preparacao`) de um chamado já existente |

### Observações práticas

- **Os três flows** (`chamadofilho`, `descricao`, `identificacao`) são acionados pelo mesmo
  padrão `POST /integrations/{name}/flows` com corpo = mapa de variáveis do flow. O `{name}`
  na URL é o nome do flow cadastrado no Low Code, não um id genérico. Para descobrir quais
  variáveis cada um espera, use `GET /flows/{name}/variables` (ver `endpoints.md`, seção 5).
- **`INSERE_NF` e `ATUALIZAR_DADOS_LOCACAO` apontam para a mesma URL** — o mesmo business
  object `Atendimentoesuporteclientelocacao` do projeto `FluxosDeAtendimento`. A diferença é
  o payload e o momento do fluxo (emitir NF vs. gravar data de preparação). Ambos usam o
  padrão de atualização por PK: o `{id}` do chamado vai no final da URL
  (`.../Atendimentoesuporteclientelocacao/{id}`), casando com `PUT /data/.../{pk}`.
- Como o `{id}` do chamado é a PK aqui, dá para **ler** o mesmo registro com
  `GET /data/FluxosDeAtendimento/Atendimentoesuporteclientelocacao/{id}` antes de atualizar,
  se precisar do estado atual do formulário.

---

## Parte B — Endpoints `/4biz/webmvc` e `/4biz/services` (API ITSM — fora desta skill)

Documentados aqui só para **contraste** — não são desta API Low Code e não seguem o contrato
de `endpoints.md`. São a API de processos/ITSM/CMDB do 4biz/CITSmart.

| Constante | URL real | O que faz (pela URL/uso) |
|---|---|---|
| `URL_SEARCH` | `4biz/webmvc/servicerequestincident/search` | Busca chamados (service request / incident) |
| `URL_NEXT` | `4biz/webmvc/servicerequestincident/next` | Avança o chamado para a próxima etapa/status do workflow |
| `URL_COMMENTS` | `4biz/webmvc/v1/ticket/` | Comentários/interações de um ticket (id concatenado no fim) |
| `CRIAR_PEDIDO` | `4biz/webmvc/servicerequestincident/create` | Cria um pedido/chamado |
| `CRIAR_ANEXO` | `4biz/services/request/addAttachments` | Anexa arquivo(s) a um chamado |
| `INVENTORY` | `4biz/webmvc/v1/configuration-item/inventory` | Inventário de CMDB (configuration items) |
| `UPDATE_STATUS` | `4biz/services/request/updateStatus` | Atualiza o status de um chamado |

Para o comportamento de negócio desses endpoints ITSM (máquina de estados do picking,
abertura de chamado por pedido, sincronização de CMDB), ver a skill
`sankhya-vokenext-integracao`.

---

## Resumo do que muda para quem for estender a integração

- Precisa **disparar lógica server-side** já modelada como flow (buscar chamado filho,
  alterar descrição, identificar hardware)? → `POST /lowcode/integrations/{name}/flows`.
- Precisa **ler/gravar o formulário do chamado de locação** (emitir NF, gravar data de
  preparação, etc.)? → `/lowcode/data/FluxosDeAtendimento/Atendimentoesuporteclientelocacao/{id}`.
- Precisa **abrir/avançar chamado, comentar, anexar ou mexer em CMDB**? → é a API ITSM
  `/4biz/webmvc` · `/4biz/services`, **não** esta API Low Code.
