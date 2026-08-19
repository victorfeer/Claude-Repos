# Pendências — Run2Biz (TASK 866)

**Contexto:** o lado Sankhya está concluído (campos `ORIGEM` / `IDVOKENEX` / `DHINTEGRACAO` criados, procedure `SNK_PROCIMPORTARIMAGEM_CA` ativa e leitura pela tela de contrato). Falta o Run2Biz enviar a imagem para o Sankhya.

**O que implementar:** ao cadastrar ou alterar uma imagem no CMDB do VokeNext, chamar a API do Sankhya (`DatasetSP.save`) e gravar na `AD_IMPORTAIMAGEM`, atendendo:

- **CODPARC resolvido (matriz/filial):** enviar `CODPARC = NVL(CODPARCMATRIZ, CODPARC)` do cliente — mesmo padrão do fluxo do CA de hoje. Se o cliente é filial, enviar a matriz; senão, o próprio. Sem isso a imagem entra sem cliente e **não aparece** no campo Imagem do contrato (Planejamento › Rollout, que filtra por CODPARC). Os casos de CODPARC 3508 e 5773 são tratados na tela — não exigem lógica no Run2Biz.
- **Id estável por imagem:** enviar `IDVOKENEX` (id da imagem no VokeNext) para deduplicar — reenvio deve atualizar, não criar duplicado.
- **Origem:** enviar `ORIGEM = 'VOKENEX'`.
- **Status:** enviar `STATUS = 0` para imagem ativa (a procedure só promove novos com status 0).
- **Tratar erro:** se a chamada falhar, não marcar como integrado no Run2Biz e reenviar na próxima janela.
- **Autenticação:** autenticar no gateway Sankhya — método a confirmar (token OAuth ou login MGE).

## Contrato da API

- **Endpoint (POST):** `https://erp-hml.microcity.com.br:8443/mge/service.sbr?serviceName=DatasetSP.save&outputType=json`
- **Headers:** `Content-Type: application/json` · `Authorization: <token/login do gateway>`
- **Body (raw / JSON):**

```json
{
  "serviceName": "DatasetSP.save",
  "requestBody": {
    "entityName": "AD_IMPORTAIMAGEM",
    "standAlone": false,
    "fields": ["IMAGEM","PERFILIMAGEM","CODPARC","DATACRIACAO","STATUS","ORIGEM","IDVOKENEX","IDIMAGEMCA"],
    "records": [
      { "values": {
          "0": "33.36",
          "1": "Padrão",
          "2": "<CODPARC = NVL(CODPARCMATRIZ, CODPARC)>",
          "3": "1523066035",
          "4": "0",
          "5": "VOKENEX",
          "6": "<id estável da imagem no VokeNext>",
          "7": "A034783C192D3A4F93C422A5E26D564B"
      } }
    ]
  }
}
```

Os índices em `values` correspondem à posição no array `fields`. `DATACRIACAO` = epoch em segundos; `IMAGEM` = código da imagem (chave de deduplicação e valor exibido na tela).

## Pendências a confirmar

- Método de autenticação do gateway (`/mge/service.sbr`).
- Validar o formato exato do payload contra o contrato já testado no Sankhya (o exemplo acima é a forma padrão do `DatasetSP.save`).
