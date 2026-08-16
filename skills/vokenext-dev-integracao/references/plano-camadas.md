# Plano de melhoria em camadas

Toda proposta de mudança na integração deve ser **enquadrada numa destas três camadas**. A ordem não é
decorativa: uma correção de Camada 1 sobre uma base sem Camada 0 tende a ser **revertida ou duplicada**
no próximo deploy manual, e uma mudança de Camada 2 sem Camada 1 estável vira reescrita arriscada.

Use isto para responder a pergunta 2 da "Regra de ouro" do `SKILL.md`: **em que camada isto vive?**

---

## Camada 0 — Fundação (o alicerce)

Sem isto, nada mais para em pé. É o pré-requisito de qualquer correção durável.

- **Versionamento em Git** do JAR, procedures e views — fonte única da verdade. (Já existe:
  `victorfeer/DevsVoke`, espelhado para o Azure DevOps `voke-erp`.)
- **Separação formal HML × PROD** — ambientes distintos, parâmetros por ambiente, nada de hardcode que
  quebre na virada.
- **Revisão de código e testes** — PR revisado antes de `main`; testes ao menos nos pontos críticos.

**Alerta de dependência:** ao propor qualquer item de Camada 1, verifique se a Camada 0 cobre aquele
artefato. Se a procedure/view que você vai corrigir **não está versionada** ou **não tem separação
HML×PROD**, diga isso explicitamente — o fix pode se perder.

---

## Camada 1 — Estancar o sangramento (baixo esforço, alto retorno)

Correções pontuais, cirúrgicas, de baixo risco, que param dores imediatas **sem mudar o modelo**. São
as candidatas naturais a "resolver agora". Itens típicos (ver `bugs-catalogados.md` para o detalhe e o
status atual de cada um):

- Ajustar a **janela de consulta** para ≥ intervalo do schedule (P0.7, paliativo).
- **Granularidade de view** / corrigir consulta que retorna demais (P0.4 análogo).
- **Bind de parâmetro** correto no `setNamedParameter` (P0.4).
- **`LISTAGG ... ON OVERFLOW TRUNCATE`** (P0.9).
- **Join de imagem por `SEQIMG`** (P1.1).
- **Grafia do flow action** alinhada ao contrato VokeNext (P1.5).
- **Reativar validação de estoque** (P1.3), se a desativação não foi intencional.
- **Cache de token** no `Auth` (P1.6).
- **Isolar `NPE` por item** no lote de `emitirNF` (P0.8).
- **Extrair hardcodes** para `TSIPAR` (P2.1).

Regra prática: se dá para fazer com um diff pequeno, sem redesenhar a máquina de estados nem o
transporte, e reduz dívida — é Camada 1.

---

## Camada 2 — Mudar o modelo (estrutural)

Mudanças que alteram **como a integração funciona**, não só um trecho. Maior esforço e risco; exigem
diagramas, validação e, em geral, Camada 0 estável. Itens típicos:

- **Trocar polling por eventos / outbox** com estado e tentativas — mata P0.2 e boa parte de P0.1/P0.3
  de uma vez. Persistir a intenção de integração (marca de pendência) e processar com retry idempotente.
- **Máquina de estados de verdade** — todos os estados alcançáveis, cada um com gravador e leitor
  explícitos; `ES` e órfãos resolvidos (P0.3); `SF` só após separação real (P0.1).
- **Idempotência por chave de negócio** — reprocessar sem duplicar (P1.4, P0.5).
- **Tirar HTTP de dentro da transação** de banco (P0.6) — persistir e chamar fora do commit.
- **Migrar regra enterrada em views/funções** para camada versionada e testável (P2.5).
- **Observabilidade** — reprocessamento sobre `IntegracaoLog` + alerta; integração via gateway com JSON
  para aparecer no monitoramento de API (P0.5).

Regra prática: se muda o **transporte**, o **modelo de estado** ou a **fronteira transacional** — é
Camada 2. Nomeie sempre a alternativa de Camada 2 mesmo quando fizer só o paliativo de Camada 1, para
que a dívida fique registrada.

---

## Como enquadrar uma mudança nova

1. Identifique o item de bug (ou requisito) que ela endereça.
2. Classifique: muda modelo/transporte/transação → **C2**; diff cirúrgico → **C1**; é infra de
   versionamento/ambiente/teste → **C0**.
3. Cheque a dependência de camada inferior (C1 exige C0 do artefato; C2 exige C1 estável no entorno).
4. Se for paliativo de C1 que deixa a dívida de C2 de pé, **diga isso** e registre a alternativa.
