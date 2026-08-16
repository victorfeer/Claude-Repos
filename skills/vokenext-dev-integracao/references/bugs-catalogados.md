# Catálogo vivo de bugs e dívida técnica

Referência **viva** dos problemas conhecidos da integração Sankhya × VokeNext, por severidade.
Cada item traz: **sintoma → causa → direção de correção → camada → status**.

> **Como usar:** este catálogo é um snapshot do conhecimento, não uma foto fiel do código de hoje.
> **Sempre confirme no repositório `victorfeer/DevsVoke` (`main` + branches/PRs)** que o item ainda
> existe antes de propor a correção. Ao resolver, atualize o status citando branch/PR e data.
> A tabela de status usa: `ABERTO` · `RESOLVIDO` · `A CONFIRMAR` (precisa checar no código atual).

Legenda de camada (ver `plano-camadas.md`): **C0** fundação · **C1** estancar sangramento ·
**C2** mudar o modelo.

---

## P0 — Críticos

### P0.1 `STATUSPICKING='SF'` gravado antes da separação real
- **Sintoma:** registro nasce já em "Separação Finalizada"; etapas anteriores nunca acontecem de fato.
- **Causa:** gravação do status final sem passar pelos estados intermediários reais.
- **Correção:** só gravar `SF` após a separação concluída de verdade; guarda de transição. — **C2**
- **Status:** A CONFIRMAR no código atual (parte da máquina de estados; ver P0.3).

### P0.2 Polling de estado mutável perde transições
- **Sintoma:** chamado não avança; pedido "some" do fluxo sem erro visível.
- **Causa:** schedules fazem *polling* de `AD_TGFINTE.STATUSPICKING` (15–20s). Sem fila, sem marca de
  pendência, sem reprocessamento. Mudança mais rápida que o intervalo é perdida silenciosamente.
- **Correção:** modelo de eventos/outbox com estado e tentativas; ou guarda de transição que rejeita
  saltos. — **C2**
- **Status:** ABERTO (modelo ainda é polling). Há guardas pontuais começando (ex.: guarda `NE->EX` em
  `ScheduleEnviarDadosNota`), sinal de C2 incremental.

### P0.3 Estado `ES` (Em Separação) inalcançável / estados órfãos
- **Sintoma:** estados que ninguém grava ou ninguém lê; lacunas na máquina de estados.
- **Causa:** `ES` não é gravado nem lido; `EP` gravado mas nenhum schedule lê; `PF`/`PAF` sem gravador
  identificado no código.
- **Correção:** redesenhar a máquina de estados com todos os estados alcançáveis e com gravador/leitor
  explícitos. — **C2**
- **Status:** A CONFIRMAR (estado `PI` de packing já foi adicionado recentemente; revalidar o mapa
  completo antes de afirmar quem grava o quê).

### P0.4 `setNamedParameter` sem bind correto leva chamado ao pedido errado
- **Sintoma:** chamado abre vinculado ao pedido/nota errado.
- **Causa:** parâmetro nomeado sem bind efetivo (o `:PARAM` não faz efeito), consulta retorna linha
  errada. Bug histórico análogo: `consultaEmpresa.sql` retornava a view inteira porque `:CODPARC` não
  fazia efeito.
- **Correção:** garantir bind real de cada parâmetro; testar com valores distintos. — **C1**
- **Status:** A CONFIRMAR por controller (há vários `setNamedParameter` em `EmpresaController`,
  `PedidosController`, `HardwareController`, `ContratoController` — auditar cada um).

### P0.5 Erros HTTP engolidos sem retry/alerta
- **Sintoma:** falha de rede não gera reprocessamento nem aviso; etapa some.
- **Causa:** `catch` que ignora e segue; sem retry, sem alerta, observabilidade quase nula (só
  `server.log`).
- **Correção:** tratamento real de erro HTTP (retry idempotente + alerta); reprocessamento sobre
  `IntegracaoLog`. — **C2**
- **Status:** ABERTO.

### P0.6 Chamadas HTTP dentro de transação de banco
- **Sintoma:** transação longa segurando lock enquanto espera a rede; risco de inconsistência.
- **Causa:** HTTP disparado dentro do escopo transacional.
- **Correção:** tirar o HTTP da transação; persistir intenção (outbox) e chamar fora do commit. — **C2**
- **Status:** A CONFIRMAR (auditar controllers/schedules que abrem transação e chamam a API).

### P0.7 Janela de consulta menor que o intervalo do schedule perde alterações do CMDB
- **Sintoma:** metade das alterações do CMDB não é sincronizada.
- **Causa:** a janela temporal da consulta é menor que o intervalo entre execuções do schedule; o gap
  entre janelas cai no vão.
- **Correção:** janela ≥ intervalo do schedule com sobreposição, ou marca de "último processado"
  (high-water mark) em vez de janela por tempo. — **C1** (paliativo) / **C2** (high-water mark).
- **Status:** A CONFIRMAR (checar os schedules de sincronização de CMDB e a janela de cada um).

### P0.8 `NPE` em `emitirNF` aborta o lote inteiro
- **Sintoma:** um item problemático derruba a emissão de todo o lote.
- **Causa:** `NullPointerException` não isolado por item; exceção sobe e mata o processamento do lote.
- **Correção:** isolar o processamento por item (try/catch por elemento), registrar o item falho e
  seguir o lote. — **C1**
- **Status:** A CONFIRMAR (localizar `emitirNF` e o laço de lote).

### P0.9 `LISTAGG` sem `ON OVERFLOW`
- **Sintoma:** query estoura quando a concatenação passa de 4000 bytes (VARCHAR2).
- **Causa:** `LISTAGG(...) WITHIN GROUP (...)` sem cláusula `ON OVERFLOW TRUNCATE`.
- **Correção:** `LISTAGG(... ON OVERFLOW TRUNCATE ...)` (ou repensar o agregado). — **C1**
- **Status:** ABERTO — confirmado em `PedidosController.java` (montagem de `DESCRPRODUTO`, ~linha 342):
  `LISTAGG(...) WITHIN GROUP (ORDER BY PRO2.CODPROD)` sem `ON OVERFLOW`.

---

## P1 — Relevantes

### P1.1 Join de imagem por `SEQ` em vez de `SEQIMG`
- **Sintoma:** imagem errada (ou "SEM_IMAGEM") associada ao item.
- **Causa:** join `AD_PLANEIMAGEM IMG2 ON IMG2.SEQ = ROL2.SEQ` — a chave correta de imagem é `SEQIMG`.
- **Correção:** corrigir o join para a chave de imagem correta. — **C1**
- **Status:** ABERTO — confirmado em `PedidosController.java` (~linha 342): `LEFT JOIN AD_PLANEIMAGEM
  IMG2 ON IMG2.SEQ = ROL2.SEQ`.

### P1.2 `INNER JOIN` com transportadora esconde notas sem transportadora
- **Sintoma:** notas sem `CODPARCTRANSP` somem da consulta e nunca integram.
- **Causa:** `INNER JOIN TGFPAR PAR ON PAR.CODPARC = CAB.CODPARCTRANSP` — quem não tem transportadora
  é filtrado fora.
- **Correção:** `LEFT JOIN` e tratar transportadora nula no payload. — **C1**
- **Status:** ABERTO — confirmado em `PedidosController.java` (~linha 342), `INNER JOIN TGFPAR`.

### P1.3 Validação de estoque comentada
- **Sintoma:** integra pedido sem checar disponibilidade que a regra pedia.
- **Causa:** bloco de validação de estoque comentado no código.
- **Correção:** reativar a validação (confirmar antes se a desativação foi intencional). — **C1**
- **Status:** A CONFIRMAR (localizar o bloco comentado).

### P1.4 Concorrência em `MAX(SEQ)+1` sem lock
- **Sintoma:** colisão de sequência sob concorrência; chaves duplicadas ou sobrescrita.
- **Causa:** geração de sequência via `MAX(SEQ)+1` sem lock/serialização.
- **Correção:** sequência do banco, ou lock/`SELECT ... FOR UPDATE`, ou chave de negócio idempotente.
  — **C2**
- **Status:** A CONFIRMAR.

### P1.5 Grafia divergente de flow action
- **Sintoma:** transição recusada pelo Run2Biz por nome de flow action que não bate.
- **Causa:** a string do flow action no Java diverge da grafia esperada pelo VokeNext.
- **Correção:** alinhar a grafia com o contrato do VokeNext (confirmar com o time deles) e centralizar
  a constante. — **C1** (+ handshake de contrato, ver `lado-vokenext.md`).
- **Status:** A CONFIRMAR.

### P1.6 Auth sem cache de token
- **Sintoma:** um pedido de token OAuth por chamada; latência e risco de throttling.
- **Causa:** `Auth` não guarda o token enquanto válido.
- **Correção:** cachear o access token respeitando o `expires_in`, renovando só ao expirar. — **C1**
- **Status:** A CONFIRMAR (revisar `voke/service/Auth.java`).

---

## P2 — Dívida técnica

### P2.1 Hardcodes espalhados
- **Sintoma:** quebra na virada HML→PROD; valores fixos no código.
- **Causa:** IDs de modelo de impressão (ex.: 443), TOP, empresa, contrato (ex.: 1644), endpoints
  fixos no Java/procedures em vez de `TSIPAR`/`MGECoreParameter` ou tabela de config.
- **Correção:** extrair para parâmetro de sistema. — **C1**
- **Status:** ABERTO (padrão recorrente).

### P2.2 Código morto
- **Sintoma:** ruído, risco de manutenção sobre trecho inativo.
- **Causa:** métodos/estados sem gravador nem leitor, schedules inativos (ex.: encerramento manual em
  vez de `encerrarsolicitacao` automático).
- **Correção:** remover ou reativar conscientemente. — **C1**
- **Status:** A CONFIRMAR.

### P2.3 `WM_CONCAT` não suportado
- **Sintoma:** função não suportada na versão de banco; falha ou comportamento indefinido.
- **Causa:** uso de `WM_CONCAT` (não oficial/descontinuado).
- **Correção:** trocar por `LISTAGG` (com `ON OVERFLOW`, ver P0.9). — **C1**
- **Status:** A CONFIRMAR.

### P2.4 `System.out.println` / `printStackTrace` espalhados
- **Sintoma:** sem log estruturado; erro impresso e engolido.
- **Causa:** herança de código legado.
- **Correção:** trocar pela camada de log de `voke/utils`; erro tratado, não impresso. — **C1**
- **Status:** ABERTO — ~90 ocorrências no código atual.

### P2.5 Regra de negócio enterrada em views/funções
- **Sintoma:** lógica invisível, sem versionamento e sem teste, difícil de mudar com segurança.
- **Causa:** `VIEW_VOKE_ITSM_*`, `VW_ITSM_CMDB_*` e funções `MICRO_FUNC_*` concentram regra.
- **Correção:** migrar a lógica para camada versionada, aos poucos; qualquer alteração aqui com cautela
  redobrada. — **C2**
- **Status:** ABERTO.

---

## Já resolvidos (histórico — não re-propor)

Confirme sempre na `main`, mas estes já entraram e **não devem ser sugeridos como se fossem novos**:

- **Estado `PI` (Packing Iniciado)** adicionado à máquina de estados do picking (ver
  `docs/fluxo-packing.md` no repo).
- **`data_preparacao`** incluída no payload de criação do chamado (ver `docs/data-preparacao.md`).

> Ao fechar um item deste catálogo, mova-o para cá com a referência do PR/branch e a data.
