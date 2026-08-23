# Endpoint VokeNext — Carga de Chamado (serviceRequestIncident.load)

> ⚠️ **Não commitar tokens/cookies reais neste arquivo.** O token Bearer e os cookies
> de sessão do curl original foram redigidos. Gere um token válido em tempo de execução.

## Ambiente
- **HOM (homologação):** `https://vokenex-hom.4bizoxygen.com`
- SSO / realm: `https://sso.4bizoxygen.com/auth/realms/vokenex-hom`

## Requisição — carregar um chamado por id

```bash
curl --location 'https://vokenex-hom.4bizoxygen.com/4biz/serviceRequestIncident/serviceRequestIncident.load' \
  --header 'Accept: application/json' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer <TOKEN_REDIGIDO>' \
  --data '{
    "object": {
      "id": 6908,
      "idContrato": 6,
      "nomeServico": "Atendimento e Suporte Cliente Locação"
    }
  }'
```

### Corpo (payload)
| Campo               | Exemplo                                   | Observação                          |
|---------------------|-------------------------------------------|-------------------------------------|
| `object.id`         | `6908`                                     | ID do chamado a carregar            |
| `object.idContrato` | `6`                                        | Contrato vinculado                  |
| `object.nomeServico`| `Atendimento e Suporte Cliente Locação`    | Nome do serviço                     |

## Observações importantes
- **`.load` carrega UM chamado por `id`** — não é busca/listagem. Para o objetivo da
  reunião (filtrar/listar vários chamados por grupo executor, responsável, etc.) ainda
  é necessário localizar o endpoint de **search/list** correspondente.
- Cenário de exemplo da reunião: chamados **904 (pai) → 905 → 906 / 908**.
- Autenticação: token via realm `vokenex-hom` (Keycloak/4biz Oxygen). O token do curl
  original expira (campo `exp` do JWT) — obter um novo a cada sessão de teste.
