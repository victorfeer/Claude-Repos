# Integração com o Sankhya — abordagens, vantagens e desvantagens

O sistema pode obter os dados da NF-e por quatro caminhos. Abaixo o comparativo
e a **recomendação de arquitetura**.

---

## Opção A — API REST do Sankhya (Gateway / OAuth 2.0)  ✅ recomendada como primária

Autenticação por **OAuth 2.0 Client Credentials + `X-Token`**
(`POST https://api.sankhya.com.br/authenticate`), depois chamadas a serviços
como `DbExplorerSP.executeQuery` / `DatasetSP.loadRecords`.

**Vantagens**
- Não expõe o banco Oracle; usa a camada oficial e suportada.
- Respeita regras de segurança/licenciamento do ERP.
- Funciona mesmo com Sankhya em nuvem (sem acesso ao banco).
- Credenciais **por empresa** → encaixa no modelo multi-tenant.

**Desvantagens**
- Latência e limites de rate do Gateway.
- Depende de o cliente habilitar a Área do Desenvolvedor e gerar `X-Token`.
- Payloads de serviço mais verbosos.

---

## Opção B — Consulta direta ao banco Oracle do Sankhya

`SELECT` direto em `TGFCAB/TGFITE/TGFPAR` via JDBC (usuário read-only).

**Vantagens**
- Menor latência; ideal para sincronização/carga em lote.
- Controle total da query (joins, filtros, performance).

**Desvantagens**
- **Alto acoplamento** ao schema; quebra em upgrades do ERP.
- Risco de segurança/licenciamento (acesso fora da aplicação).
- Inviável se o Sankhya estiver em nuvem gerenciada (sem acesso ao Oracle).
- Precisa de VPN/rede privada até o banco do cliente.

> Uso adequado: **job de sincronização** interno em on-premises, nunca como
> caminho de request do usuário final.

---

## Opção C — Rotinas Java do Sankhya (customização no ERP)

Uma `AcaoRotinaJava`/serviço dentro do próprio Sankhya expõe/empurra os dados.

**Vantagens**
- Reaproveita regras de negócio e `EntityFacade` do ERP.
- Pode publicar eventos (push) quando a nota é autorizada.

**Desvantagens**
- Exige deploy de `.jar` no servidor Sankhya e manutenção acoplada ao ERP.
- Ciclo de release mais lento; conhecimento especializado.
- Menos aderente a um SaaS externo genérico.

> Uso adequado: quando já existe customização Java (voke.jar) e se deseja
> **push em tempo real** da nota autorizada para o cache do SaaS.

---

## Opção D — Repositório próprio de XMLs (cache)

O SaaS mantém sua própria base de NF-e/XML (tabelas `nota_fiscal` + `nota_xml`).

**Vantagens**
- Respostas em milissegundos; independência do ERP em runtime.
- Escala horizontal sem pressionar o Oracle.
- Permite consulta de notas mesmo com ERP indisponível.

**Desvantagens**
- Precisa de estratégia de povoamento/sincronização e invalidação.
- Armazenamento e conformidade LGPD do XML sob responsabilidade do SaaS.

---

## Recomendação (arquitetura híbrida)

```
Request do usuário → [D] Cache próprio  → hit: responde
                                        → miss: [A] API REST Sankhya (on-demand)
Povoamento em massa → [B] Oracle read-only OU [C] push Java  (jobs assíncronos)
SEFAZ → apenas quando permitido e a nota não pertence ao emitente
```

- **Runtime do usuário:** sempre **Cache (D)**; em *miss*, **API REST (A)**.
- **Carga histórica/backfill:** **Oracle read-only (B)** on-premises ou
  **push via Java (C)** quando houver customização.
- **SEFAZ:** opcional, sujeito a certificado digital e regras de acesso.

Essa combinação entrega **velocidade** (cache), **baixo acoplamento e
segurança** (API oficial), e **escala** (ERP fora do caminho crítico) — os três
objetivos declarados.

---

## Referência de autenticação (API Sankhya)

```
POST https://api.sankhya.com.br/authenticate
Content-Type: application/x-www-form-urlencoded
X-Token: <token do Gateway (Sankhya Om → Configurações → Gateway)>

client_id=<...>&client_secret=<...>&grant_type=client_credentials
→ 200 { "access_token": "<JWT>" }
```

Uso subsequente: `Authorization: Bearer <access_token>`.
Renovar automaticamente ao receber `401`. Implementação em
`backend/.../integration/SankhyaClient.java`.
