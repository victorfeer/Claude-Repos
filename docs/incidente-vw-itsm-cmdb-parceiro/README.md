# Incidente — `VW_ITSM_CMDB_PARCEIRO` ausente em produção

**Sintoma:** ao criar/alterar parceiro na tela **Parceiros** (`TGFPAR`), o Sankhya aborta com

```
Regra Personalizada:
java.sql.SQLSyntaxErrorException: ORA-00942: a tabela ou view não existe
Tipo: Rotina java
Nome: voke.eventos.EventoEmpresaCMDB
```

**Causa:** a view `VW_ITSM_CMDB_PARCEIRO` não existe no banco de produção.

## Cadeia de chamada

```
Gravar parceiro (TGFPAR)
  └─ Evento "Evento Empresa CMDB" — voke.eventos.EventoEmpresaCMDB (módulo 52)
       └─ afterInsert / afterUpdate → EmpresaController.verificarEmpresa()
            └─ buscarDadosEmpresa() → voke/controller/sql/consultaEmpresa.sql
                 └─ SELECT * FROM VW_ITSM_CMDB_PARCEIRO WHERE IDENTIFICADOR = :CODPARC
                      └─ ORA-00942
```

## Por que derruba o cadastro inteiro

`EmpresaController.buscarDadosEmpresa()` faz `catch (Exception e) { throw new
RuntimeException(e); }` e `EventoEmpresaCMDB.afterInsert()` propaga. Como o evento de
persistência é **síncrono**, a exceção aborta a transação do ERP.

Ou seja: **uma falha de espelhamento no CMDB está impedindo o cadastro de parceiro no
ERP**. CMDB é integração acessória — não deveria bloquear operação-núcleo. Ver
"Pendências" abaixo.

## Causa de fundo

A DDL da view **nunca esteve versionada**. Em `voke/src/main/procedures/` (repo
`victorfeer/DevsVoke`) existia apenas `VIEW_VOKE_ITSM_ATIVACAO_PEDIDO.sql` — 1 das 4 views
da integração. As outras três só existiam no banco onde alguém as criou na mão:

| View | Consumidor | Versionada antes deste incidente? |
|---|---|---|
| `VIEW_VOKE_ITSM_ATIVACAO_PEDIDO` | `PedidosController` | sim |
| `VW_ITSM_CMDB_PARCEIRO` | `EmpresaController` | **não** — este incidente |
| `VIEW_VOKE_ITSM_CONTRATO` | `ContratoController` | **não** |
| `VW_HOMEOFFICE_PREPARACAO` | `STP_INTE_INSERT` | **não** |

## Correção

Script: [`sankhya/voke/procedures/VW_ITSM_CMDB_PARCEIRO.sql`](../../sankhya/voke/procedures/VW_ITSM_CMDB_PARCEIRO.sql)
(idempotente, `CREATE OR REPLACE`).

### Ordem de aplicação

1. **Desbloqueio imediato (opcional, se precisar cadastrar parceiro antes do fix):**
   Construtor de Telas → `TGFPAR` → aba **Eventos** → "Evento Empresa CMDB" → desligar
   **Ativo**. Enquanto estiver desligado, nenhum parceiro novo vai para o CMDB — religar
   depois do passo 3.
2. **Pré-requisito** — confirmar que o campo customizado existe:
   ```sql
   SELECT COLUMN_NAME FROM ALL_TAB_COLUMNS
    WHERE TABLE_NAME = 'TGFPAR' AND COLUMN_NAME = 'AD_DHALTERPARCEIRO';
   ```
   Vazio → cadastrar o campo pelo dicionário **ou** trocar o `NVL(...)` do script por
   apenas `PAR.DTALTER`.
3. **Aplicar o script** com o usuário dono do schema do Sankhya. Se for outro usuário,
   aplicar também o `GRANT` + `SYNONYM` que estão comentados no fim do script.
4. **Verificar** — as três queries de verificação no rodapé do script.
5. **Religar o evento** (se desligado no passo 1) e refazer o cadastro do parceiro que
   falhou.

### Rollback

A view é aditiva e não é lida por nada fora do módulo 52. Rollback = `DROP VIEW
VW_ITSM_CMDB_PARCEIRO` + desligar o evento em `TGFPAR` — volta ao estado do incidente
(cadastro de parceiro funcionando, CMDB de parceiro sem espelhamento).

## Efeito colateral do mesmo defeito

A mesma view alimenta `consultaEmpresaDia.sql`, consumido pela **ação agendada 173 —
Integração CMDB (Empresa/Parceiro)** (`ScheduleChecarEmpresaCMDB`, 20 min), que também faz
`throw new RuntimeException(e)`. Essa schedule vinha **estourando a cada 20 minutos** desde
que a view sumiu. Conferir `AD_INTEGRAITSMLOG` e o log de Ações Agendadas para dimensionar
desde quando.

## Pendências levantadas (não corrigidas aqui)

1. **Resiliência do evento (P0).** `EventoEmpresaCMDB` deve capturar a falha, registrar em
   `AD_INTEGRAITSMLOG` (`IntegracaoLog.erroCMDB`) e **não** relançar. Nenhuma indisponibilidade
   de CMDB — view ausente, API do Run2Biz fora, token expirado — pode impedir cadastro de
   parceiro no ERP.
2. **Versionar as outras duas views** (`VIEW_VOKE_ITSM_CONTRATO`, `VW_HOMEOFFICE_PREPARACAO`)
   em `voke/src/main/procedures/`, antes que o mesmo incidente aconteça com elas.
3. **Janela da schedule 173.** O `consultaEmpresaDia.sql` filtra `SYSDATE - (10/1440)`
   (10 min) mas a ação roda a cada **20 min** — metade das alterações de parceiro nunca é
   observada. Aritmética pura: a janela precisa ser >= o intervalo, com folga.
4. **Escopo do evento.** A view não filtra `CLIENTE = 'S'` e o evento dispara em **todo**
   `TGFPAR` — fornecedor, transportadora, vendedor. Confirmar com o negócio se o CMDB deve
   mesmo receber todo parceiro ou só cliente.
5. **`RUA` com código em vez de descrição.** A montagem usa `EN.CODLOGRADOURO`, que é o
   código do tipo de logradouro. Conferir no dado real se o CMDB está recebendo
   `"1 CENTRAL 250"` em vez de `"RUA CENTRAL 250"` — se sim, falta o join com a tabela de
   tipo de logradouro.
