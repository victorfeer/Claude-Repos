# Consulta NF-e SaaS · Voke

Solução SaaS responsiva para **consulta de Notas Fiscais Eletrônicas (NF-e)
pela chave de acesso (44 dígitos)**, com exibição dos dados em tela e
**geração de PDF** — integrada ao **ERP Sankhya**.

> Projetada por um Arquiteto de Software Sênior para ser rápida, segura e
> escalável, pronta para comercialização como SaaS multiempresa.

## O que já está pronto neste repositório

| Entregável | Onde |
|---|---|
| Arquitetura completa + diagrama de componentes + fluxos | [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) |
| Abordagens de integração Sankhya (vantagens/desvantagens + recomendação) | [`docs/INTEGRACAO-SANKHYA.md`](docs/INTEGRACAO-SANKHYA.md) |
| Modelagem de banco (PostgreSQL + RLS multiempresa) | [`db/schema.sql`](db/schema.sql) |
| **Frontend HTML5 funcional** (Bootstrap 5, responsivo, com modo demo) | [`frontend/`](frontend/) |
| Geração de PDF (jsPDF + QR Code da chave) | [`frontend/assets/js/pdf.js`](frontend/assets/js/pdf.js) |
| Backend skeleton (Spring Boot 3 / Java 21) + integração OAuth2 Sankhya | [`backend/`](backend/) |
| Segurança (JWT, BCrypt, RBAC, CSP, anti-SQLi/XSS) | [`backend/.../security/SecurityConfig.java`](backend/src/main/java/tech/voke/nfe/security/SecurityConfig.java) |
| Plano de implantação | [`docs/PLANO-IMPLANTACAO.md`](docs/PLANO-IMPLANTACAO.md) |
| Custos estimados de hospedagem | [`docs/CUSTOS-HOSPEDAGEM.md`](docs/CUSTOS-HOSPEDAGEM.md) |

## Testar agora (30 segundos, sem backend)

```bash
cd frontend
python3 -m http.server 8080
# http://localhost:8080 → botão "Usar chave de exemplo (demo)" → Consultar → Gerar PDF
```

O frontend opera em **modo demonstração** (dados mock) até o backend ser
configurado — permite validar a experiência completa (consulta → tela → PDF
com QR Code) imediatamente.

## Arquitetura em uma frase

Frontend estático (CDN) → API REST stateless (Spring Boot + JWT) →
**cache próprio (PostgreSQL)** como fonte primária em runtime, com *cache miss*
resolvido pela **API REST oficial do Sankhya (OAuth 2.0 + X-Token)**; PDF
gerado no cliente. Detalhes e trade-offs em [`docs/`](docs/).

## Stack

- **Frontend:** HTML5, Bootstrap 5, JavaScript (vanilla), jsPDF, QRCode.js.
- **Backend:** Java 21, Spring Boot 3, Spring Security (OAuth2 Resource Server).
- **Banco:** PostgreSQL 15+ (multiempresa via Row Level Security).
- **Integração:** API REST Sankhya (Gateway/OAuth2), com opções de Oracle
  read-only e push via rotina Java para backfill.

---
Identidade visual: **Voke** — azul marinho `#1B3D6D`, rosa `#F291D6`.
