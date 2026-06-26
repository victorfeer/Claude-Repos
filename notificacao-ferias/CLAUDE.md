# CLAUDE.md

Este arquivo orienta o Claude Code ao trabalhar neste repositório.

## O que é este projeto

Customização Java para o ERP **Sankhya Om**, de um cliente da Voke. Objetivo:
notificar o DP (por e-mail + notificação no "sininho" nativo do Sankhya)
quando um colaborador entra na janela crítica de férias a vencer.

Stack: Java (rodando dentro do Sankhya, via "Módulo Java"/Ação Agendada),
PL/SQL (Oracle), sem build tool próprio definido ainda (ver pendências).

## Como o projeto está organizado

```
sql/
  vw_alerta_ferias_a_vencer.sql      -- view (CONFIRMADA, validada com key user)
  stp_notifica_sistema_custom.sql    -- procedure de notificação (CONFIRMADA)
  ad_ferias_notificado.sql           -- DDL da tabela auxiliar de controle do modo DIFF
src/main/java/br/com/voke/rh/ferias/
  AlertaFeriasNotificacao.java       -- classe principal (PARCIALMENTE RECONSTITUÍDO)
docs/
  fluxo-decidido.md                  -- decisões de negócio já fechadas
  pendencias.md                      -- as 3 pendências técnicas abertas
```

## Regra mais importante deste repositório

**O arquivo `AlertaFeriasNotificacao.java` foi reconstituído a partir de
histórico de conversas, não de um arquivo final salvo.** Ele tem comentários
`[RECONSTITUÍDO -- REVISAR]` em todo método cuja forma final não pôde ser
confirmada com certeza. Ao trabalhar neste arquivo:

- NÃO assuma que um método marcado `[RECONSTITUÍDO -- REVISAR]` está correto
  só porque compila ou parece razoável — ele precisa de validação contra o
  comportamento real do Sankhya no ambiente do cliente.
- Métodos marcados **CONFIRMADO** (dedução por funcionário, montagem de
  mensagem de e-mail/sino, a procedure SQL) vieram de decisões já fechadas
  com o key user e podem ser tratados como corretos.
- Os 3 `TODO` numerados ([1], [2], [3] no cabeçalho do arquivo) são bloqueios
  reais de produção, não apenas estilo de código. Não remova os comentários
  de incerteza ao refatorar — eles são a memória do que falta validar.

## As 3 pendências técnicas (nenhuma resolvida ainda)

1. **Assinatura real da interface `ScheduledAction`** (pacote `Cuckoo.jar`)
   — não é documentada publicamente. Só se descobre abrindo o jar no
   ambiente real do cliente (ver `docs/pendencias.md` para o comando).
2. **Mecanismo real de envio de e-mail fora do contexto de botão** — o
   recurso de e-mail documentado do Sankhya está amarrado a `AcaoRotinaJava`
   (botão), não a `ScheduledAction` (rotina agendada). Ainda não confirmado
   o equivalente para rotina agendada pura.
3. **`CODGRUPO_DP`** — código do grupo de key users do DP cadastrado no
   Sankhya. Placeholder em `0` no código.

Não implemente soluções definitivas para essas 3 pendências sem confirmação
explícita do usuário — são bloqueios de ambiente real, não de lógica de
código, e uma solução "plausível" pode estar simplesmente errada para a
versão do Sankhya deste cliente.

## Decisões de negócio já fechadas (não rediscutir sem necessidade)

- Sininho recebe **um aviso por colaborador** (não uma lista concatenada).
- E-mail pode ser **uma lista concatenada** num corpo só.
- Dois modos de execução: `DIFF` (diário, só quem é novo na janela) e
  `COMPLETO` (relatório mensal, todo mundo na janela, não marca como
  notificado).
- Deduplicação por funcionário: quando o mesmo `CODFUNC` aparece em mais de
  um período de férias na janela, mantém-se só o de menor `diasParaVencer`.
- Janela de alerta: 90 dias de antecedência.

## Convenções deste repositório

- Pacote Java: `br.com.voke.rh.ferias`
- Nomenclatura de procedures customizadas: `STP_NOTIFICA_SISTEMA_CUSTOM` é
  placeholder — se o ambiente tiver convenção própria (ex.: prefixo `AD_`),
  ajustar nome em todos os lugares (Java + SQL).
- A view `VW_ALERTA_FERIAS_A_VENCER` não deve ter lógica alterada sem
  validar novamente com o key user de RH — ela é a fonte de verdade
  acordada para "quem está na janela de férias a vencer".

## O que NÃO fazer

- Não inserir diretamente na tabela `TSIAVI` — sempre via procedure
  (`STP_NOTIFICA_SISTEMA_CUSTOM` ou a nativa `STP_NOTIFICA_SISTEMA`), que
  encapsula regras de negócio do sistema (ex.: cache de notificações não
  lidas) que um INSERT direto pularia.
- Não ativar a Ação Agendada em modo `DIFF` em produção antes de criar a
  tabela auxiliar de controle (`AD_FERIAS_NOTIFICADO`, sugestão de DDL no
  fim do `.java`) — sem ela, o mesmo alerta duplica todos os dias.
- Ações agendadas do tipo Java no Sankhya costumam exigir autorização do
  administrador em "Autorização de Customização" na 1ª ativação e após
  qualquer alteração de classe — sem isso, a ação fica ativa mas nunca
  dispara. Lembrar o usuário disso ao chegar perto de produção.
