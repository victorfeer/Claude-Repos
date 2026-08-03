# Custos estimados de hospedagem SaaS

> Ordens de grandeza para planejamento (valores de referência em USD/mês,
> variam por provedor, região e câmbio). Objetivo: dimensionar o investimento
> mensal de infraestrutura, não cotar um fornecedor específico.

## Cenário 1 — MVP / poucos clientes (até ~20 empresas, baixo volume)

| Item | Opção | Custo/mês (US$) |
|---|---|---|
| Frontend estático | CDN/Static hosting (Netlify/Cloudflare/S3+CDN) | 0–5 |
| Backend | 1 container pequeno (Fly.io / Render / App Runner) | 10–25 |
| PostgreSQL gerenciado | instância pequena (Neon/Supabase/RDS t4g.micro) | 15–30 |
| Object storage (XML) | S3/R2 (baixo volume) | 1–5 |
| TLS / domínio / e-mail | Let's Encrypt + domínio + SMTP transacional | 5–15 |
| **Total aproximado** | | **~US$ 30–80/mês** |

## Cenário 2 — Crescimento (centenas de empresas, volume médio)

| Item | Opção | Custo/mês (US$) |
|---|---|---|
| Frontend | CDN com tráfego maior | 5–20 |
| Backend | 2–3 instâncias atrás de load balancer (autoscaling) | 60–150 |
| PostgreSQL | instância média + réplica de leitura | 80–200 |
| Object storage | volume de XML crescente | 10–40 |
| WAF + rate limit | Cloudflare Pro / AWS WAF | 20–50 |
| Observabilidade | logs/métricas (Grafana Cloud/Datadog free-tier+) | 0–50 |
| **Total aproximado** | | **~US$ 175–510/mês** |

## Cenário 3 — Escala (milhares de empresas)

Faixa típica **US$ 800–3.000+/mês**, dominada por: cluster de banco
(HA + réplicas), múltiplas instâncias do backend com autoscaling, cache
distribuído (Redis), WAF/CDN em plano empresarial e observabilidade completa.

## Direcionadores de custo

- **Cache hit ratio**: quanto mais alto, menos chamadas ao Sankhya e menor
  necessidade de escalar backend/DB — principal alavanca de economia.
- **Armazenamento de XML**: mover XML pesado para object storage (S3/R2)
  barateia o banco e melhora performance das consultas.
- **PDF client-side**: elimina CPU/tráfego de geração de PDF no servidor.
- **Stateless + autoscaling**: paga-se pela carga real, não pelo pico.

## Modelo de precificação sugerido (SaaS)

Cobrança por **empresa/plano** com limites de consultas/mês:
TRIAL (grátis, limitado) → BÁSICO → PRO → ENTERPRISE. A margem melhora com o
cache (custo marginal por consulta tende a zero em notas já consultadas).
