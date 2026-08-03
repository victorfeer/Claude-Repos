# Backend · Consulta NF-e (integração Sankhya OAuth 2.0)

Serviço Spring Boot (Java 21) que recebe a **chave de acesso** e consulta a NF-e
na **API do Sankhya** (Gateway OAuth 2.0), devolvendo os dados em JSON para a tela.

## Endpoint

```
GET /api/v1/nfe/{chave}        # chave = 44 dígitos
→ 200  NotaFiscalDTO (JSON)
→ 404  nota não localizada
→ 502  erro na comunicação com o Sankhya
→ 503  integração Sankhya não configurada
```

## Configuração (variáveis de ambiente)

Obtenha `client_id`/`client_secret` na Área do Desenvolvedor
(https://areadev.sankhya.com.br) e o `X-Token` em **Sankhya Om → Configurações → Gateway**.

```bash
export SANKHYA_CLIENT_ID=xxxx
export SANKHYA_CLIENT_SECRET=xxxx
export SANKHYA_X_TOKEN=xxxx
# Origem do Sankhya que embute a tela (para o CORS)
export FRONTEND_ORIGIN=https://erp-hml.microcity.com.br:8443
export PORT=8081
```

## Rodar

```bash
mvn spring-boot:run
# ou
mvn clean package && java -jar target/nfe-consulta-saas-0.1.0.jar
```

Teste:
```bash
curl http://localhost:8081/api/v1/nfe/35240114200166000187550010000123451123456789
```

## Ligar a tela ao backend

No `sankhya/consulta-nfe-standalone.html` (ou no `index.html` empacotado), ajuste:

```js
const API = { baseUrl: "https://SEU-SERVIDOR-VOKE", tokenKey: "nfe_jwt" };
```

## Pontos que podem exigir ajuste ao seu ambiente

As SQLs em `SankhyaNfeGateway` usam os campos padrão do dicionário Sankhya
(`TGFCAB`, `TGFITE`, `TGFPAR`, `TSIEMP`, `TGFTOP`). Dependendo da versão:

- **Status de autorização**: uso `STATUSNOTA='L'` → AUTORIZADA. Se o seu ambiente
  tiver o status específico da NF-e (ex.: `STATUSNFE`), ajuste `status()`.
- **XML autorizado**: não vem por SQL simples — recuperar via a fonte de XML do
  ambiente (Monitor NF-e / repositório) e preencher no DTO.
- **PIS/COFINS por item**: incluídos apenas ICMS/IPI; adicione os campos do seu `TGFITE`.
- **Formato da resposta do Gateway**: a extração está isolada em
  `SankhyaClient.parseRows` (fieldsMetadata + rows) — ponto único de ajuste.

> Segurança: o endpoint é aberto e restrito por CORS à origem do Sankhya.
> Para produção, coloque atrás de HTTPS/rede interna da Voke e, se desejar,
> adicione autenticação (API key/JWT) — a arquitetura em `docs/` prevê isso.
