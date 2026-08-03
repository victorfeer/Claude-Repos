# Plano de implantação

## Fases

| Fase | Entregas | Duração estimada |
|---|---|---|
| **0 · Descoberta** | Acesso à Área do Dev Sankhya, geração de `X-Token`, definição de planos SaaS | 1 semana |
| **1 · MVP** | Frontend (pronto neste repo) + API de consulta + cache + integração API Sankhya + login/JWT | 3–4 semanas |
| **2 · SaaS** | Multiempresa (RLS), RBAC completo, histórico, auditoria, painel admin | 3 semanas |
| **3 · Robustez** | Backfill via Oracle/push Java, object storage de XML, observabilidade, WAF/rate limit | 2–3 semanas |
| **4 · DANFE fiel** | PDF server-side a partir do XML autorizado (layout SEFAZ) | 2 semanas |
| **5 · Go-live** | Testes de carga, LGPD/segurança, billing, monitoração | 2 semanas |

## Ambientes

- **dev** → **homolog** → **prod**, com CI/CD (GitHub Actions).
- Migrations de banco versionadas (Flyway/Liquibase) a partir de `db/schema.sql`.
- Segredos em secrets manager (nunca no repositório).

## Checklist de go-live

- [ ] TLS + HSTS + WAF + rate limiting na borda.
- [ ] Backups automáticos do PostgreSQL + teste de restore.
- [ ] Rotação de refresh tokens e expiração de JWT.
- [ ] Política de retenção LGPD (consulta/log/XML) por plano.
- [ ] Monitoração (health, latência da API Sankhya, taxa de cache hit).
- [ ] Runbook de incidente (ERP indisponível → responder do cache).

## Como rodar o protótipo (frontend)

```bash
cd frontend
python3 -m http.server 8080     # ou qualquer static server
# abrir http://localhost:8080  → clicar "Usar chave de exemplo (demo)"
```

O frontend funciona em **modo demo** (dados mock) enquanto o backend não
estiver configurado. Para apontar ao backend real, defina em `api.js`:

```js
window.NFE_CONFIG = { apiBaseUrl: "https://api.suaempresa.com.br", tokenStorageKey: "nfe_jwt" };
```
