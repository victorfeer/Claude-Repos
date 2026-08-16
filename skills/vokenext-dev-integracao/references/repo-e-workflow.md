# Repositório, workflow e como consultar o estado real

Antes de propor qualquer mudança, confirme o estado atual do código aqui. O catálogo de bugs e a
memória da conversa envelhecem; o repositório é a verdade.

## Coordenadas

- **Repo:** `victorfeer/DevsVoke` (privado). Repositório-guarda dos desenvolvimentos Sankhya da Voke.
- **Pasta do voke.jar:** `sankhya/java/Integração Vokenex itsm/`
- **Espelhamento:** GitHub Action (`.github/workflows/sync-azure-devops.yml`) espelha `sankhya/` 1:1
  para o Azure DevOps `analytics-projects / voke-erp` **a cada push na `main`**.
- **Consequência:** **`main` é produção.** O que entra na `main` vai para o Azure e, dali, para o
  ambiente. Alteração feita direto no Azure pode ser sobrescrita pelo sync — o Git é a fonte da verdade.

## Layout do módulo (`Integração Vokenex itsm/`)

```
├── pom.xml                       Maven
├── libs-repo/                    Repo Maven local dos jars Sankhya
│                                 (jape, mge-modelcore, sanutil, cuckoo, sankhyaw-extensions)
├── scripts/                      JS de botão de ação usados no Sankhya
├── docs/                         Diagramas e documentação (fluxo-packing.md, data-preparacao.md, ...)
└── voke/
    ├── pom.xml
    └── src/main/
        ├── java/voke/
        │   ├── acoes/            AcaoRotinaJava (botões de ação)
        │   ├── controller/       Comunicação com a API VokeNext (+ controller/sql/)
        │   ├── eventos/          EventoProgramavelJava
        │   ├── model/            request/response da API
        │   ├── regras/           RegraNegocioJava
        │   ├── schedule/         rotinas agendadas (ScheduleEnviarPedidosITSM, ...)
        │   ├── service/          camada HTTP (Auth, API)
        │   └── utils/            log, datas, SQL
        ├── procedures/           PL/SQL (STP_AD_PLANROL_PEDIDO, STP_INTE_INSERT, ...)
        └── resources/META-INF/   metadados do módulo
```

## Convenção de branches

- Desenvolvimento em branches **`claude/...`** (ou de feature). Nunca commit direto na `main`.
- Merge para `main` **só após validação** — e lembre que `main` dispara o sync para produção.

## Como consultar (ferramentas GitHub MCP)

Anexe o repo à sessão se preciso: `add_repo` com `victorfeer/DevsVoke`. Depois:

- **Estado consolidado:** `get_file_contents` na `main` para o arquivo que vai mexer.
- **Trabalho em andamento (evitar colisão):**
  - `list_branches` — procure branches `claude/...` tocando o mesmo ponto.
  - `list_pull_requests` (estado `open`) — veja PRs abertos; leia o diff antes de propor algo que possa
    conflitar ou duplicar.
  - `search_code` — localize onde um símbolo/consulta vive (ex.: `LISTAGG`, `setNamedParameter`,
    `STATUSPICKING`).
- **Histórico:** `list_commits` / `get_commit` para entender uma mudança recente (ex.: quando entrou o
  estado `PI` ou o `data_preparacao`).

## Checklist antes de propor código

1. Li o arquivo-alvo na `main` (não só a memória da conversa)?
2. Confirmei que o bug ainda existe (não foi corrigido em commit recente)?
3. Chequei branches `claude/...` e PRs abertos que toquem o mesmo ponto?
4. A mudança vai numa branch `claude/...`, não na `main`?
5. Se mexo em procedure/view, ela está versionada aqui (Camada 0)? Se não, sinalizei o risco?
