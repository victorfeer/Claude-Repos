# Notificação de Férias a Vencer — Sankhya Om

Customização Java + PL/SQL para o ERP Sankhya Om (cliente Voke). Notifica o
DP, por e-mail e pelo "sininho" nativo do sistema, quando um colaborador
entra na janela crítica de férias a vencer.

> **Status do projeto:** em desenvolvimento, com 3 pendências técnicas
> abertas que bloqueiam produção (ver [`docs/pendencias.md`](docs/pendencias.md)).
> O arquivo `AlertaFeriasNotificacao.java` foi parcialmente **reconstituído**
> a partir de histórico de conversas — ver aviso no topo do próprio arquivo
> e em [`CLAUDE.md`](CLAUDE.md) antes de assumir que algum trecho está
> pronto para produção.

## Estrutura

```
sql/
  vw_alerta_ferias_a_vencer.sql      # View que identifica quem está na janela de férias a vencer
  stp_notifica_sistema_custom.sql    # Procedure customizada para notificação no sininho (TSIAVI)
src/main/java/br/com/voke/rh/ferias/
  AlertaFeriasNotificacao.java       # Classe principal (rotina agendada)
docs/
  fluxo-decidido.md                  # Decisões de negócio já fechadas com o key user
  pendencias.md                      # As 3 pendências técnicas que faltam validar no ambiente
CLAUDE.md                            # Contexto para o Claude Code trabalhar neste repositório
```

## Como funciona (visão geral)

1. A view `VW_ALERTA_FERIAS_A_VENCER` (Oracle) identifica colaboradores na
   janela de 90 dias antes do limite de gozo de férias.
2. Uma classe Java cadastrada em duas Ações Agendadas do Sankhya lê essa
   view diariamente (modo `DIFF`, só novidades) e mensalmente (modo
   `COMPLETO`, relatório cheio).
3. Para cada execução com resultado, dispara:
   - um e-mail para o DP com a lista completa;
   - uma notificação individual no sininho do Sankhya por colaborador, via
     `STP_NOTIFICA_SISTEMA_CUSTOM`.

Detalhes completos das decisões de negócio em
[`docs/fluxo-decidido.md`](docs/fluxo-decidido.md).

## O que falta para ir para produção

Três pendências técnicas, nenhuma resolvida ainda — detalhadas em
[`docs/pendencias.md`](docs/pendencias.md):

1. Assinatura real da interface `ScheduledAction` do `Cuckoo.jar`.
2. Mecanismo real de envio de e-mail fora do contexto de botão.
3. Código do grupo de key users do DP (`CODGRUPO_DP`), hoje placeholder `0`.

Além disso, falta criar a tabela auxiliar de controle de quem já foi
notificado (sugestão de DDL no final do `.java`), sem a qual o modo `DIFF`
duplicaria alertas todos os dias.

## Para quem for continuar com o Claude Code

Leia [`CLAUDE.md`](CLAUDE.md) primeiro — ele documenta quais partes do
código são confiáveis (decisões já fechadas) e quais foram reconstituídas e
precisam de revisão antes de seguir.
