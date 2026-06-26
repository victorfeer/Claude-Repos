# Fluxo decidido com o key user de RH

Este documento registra as decisões de negócio já fechadas, para não
precisarem ser redebatidas a cada sessão de trabalho.

## Fluxo geral

1. A view `VW_ALERTA_FERIAS_A_VENCER` traz os colaboradores que estão na
   janela de férias a vencer (90 dias de antecedência da data limite de
   gozo).
2. Uma classe Java implementando `ScheduledAction` roda em duas Ações
   Agendadas distintas:
   - **Ação Agendada A** — CRON diário, modo `DIFF`: só notifica quem é
     novo na janela desde a última execução.
   - **Ação Agendada B** — CRON no último dia útil do mês, modo
     `COMPLETO`: relatório mensal com todos que estão na janela, sem marcar
     como notificado (não interfere no controle do modo `DIFF`).
3. Em ambos os modos, dispara:
   - **E-mail** para o DP — corpo único, lista concatenada de todos os
     colaboradores relevantes da execução.
   - **Notificação no sininho** (tabela `TSIAVI`, via procedure
     `STP_NOTIFICA_SISTEMA_CUSTOM`) — **um aviso por colaborador**, não uma
     lista concatenada, para manter o aviso individual curto e legível.

## Por que um aviso por colaborador no sininho (e não uma lista)

Decisão explícita: um aviso de sininho com uma lista inteira concatenada
fica longo demais para o formato do componente. Preferiu-se sacrificar a
visão "resumo único" no sininho em troca de clareza por aviso individual.
O e-mail, que tem mais espaço de leitura, mantém a lista concatenada.

## Deduplicação por funcionário

A `VW_ALERTA_FERIAS_A_VENCER` traz uma linha por período de férias
(`SEQUENCIA`). Quando o mesmo `CODFUNC` aparece em mais de uma linha na
mesma execução, mantém-se apenas a linha do período mais urgente (menor
`diasParaVencer`), para não gerar dois avisos iguais para a mesma pessoa.

## Decisão de risco já registrada em outra peça do projeto (tela SQL livre)

Fora do escopo direto deste fluxo de notificação, existe uma tela HTML5 à
parte (Construtor de Telas do Sankhya) com campo de SQL livre, criada para
o administrador poder rodar DDL/DML sem acesso direto ao Oracle — foi usada,
por exemplo, para rodar o `CREATE OR REPLACE VIEW` da
`VW_ALERTA_FERIAS_A_VENCER` neste ambiente. Decisão de risco registrada:
sem componente de log/histórico na tela, aceita conscientemente, com
recomendação de backup manual antes de qualquer DDL/DML executado por ela.
Essa tela não faz parte deste repositório, mas é mencionada aqui porque foi
o mecanismo usado para criar os objetos de banco deste projeto.
