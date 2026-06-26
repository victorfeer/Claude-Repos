# Pendências técnicas (atualizado em 26/06/2026)

As 3 pendências abaixo bloqueiam a versão final de produção. São sobre
comportamento real do ambiente Sankhya deste cliente, não sobre lógica de
negócio.

**Resolvido nesta sessão:** tabela auxiliar `AD_FERIAS_NOTIFICADO` — DDL
criado em `sql/ad_ferias_notificado.sql`, lógica de filtro e registro
implementada em `AlertaFeriasNotificacao.java` (métodos
`filtrarAindaNaoNotificados` e `registrarComoNotificados`). Ainda precisa
ser executada no banco antes de ativar o modo DIFF em produção.

## 1. Assinatura real da interface `ScheduledAction`

O Sankhya expõe `ScheduledAction` (pacote do `Cuckoo.jar`) como o tipo de
classe Java aceito por uma Ação Agendada — diferente de `AcaoRotinaJava`,
usada em botões. A assinatura exata (nome do método de entrada, tipo do
parâmetro de contexto) não é documentada publicamente.

**Como resolver:** abrir o `Cuckoo.jar` do ambiente do cliente e inspecionar
a interface diretamente. Exemplo de comando, ajustando o caminho real do jar:

```bash
unzip -p Cuckoo.jar br/com/sankhya/scheduler/ScheduledAction.class > /tmp/ScheduledAction.class
javap /tmp/ScheduledAction.class
```

(O caminho do pacote acima é uma suposição — ajustar conforme a estrutura
real encontrada dentro do jar.)

## 2. Mecanismo real de envio de e-mail fora do contexto de botão

A documentação oficial do Sankhya menciona o recurso "agendar envio de
e-mail" associado ao `ContextoAcao` de uma `AcaoRotinaJava` (botão). Não há
confirmação de um equivalente para `ScheduledAction` (rotina agendada pura,
sem botão/usuário disparando).

**Como resolver:** testar diretamente no ambiente, ou abrir chamado com o
suporte Sankhya perguntando especificamente sobre envio de e-mail a partir
de uma Ação Agendada Java.

## 3. `CODGRUPO_DP`

Código do grupo de key users do DP, cadastrado no Sankhya, que deve receber
as notificações via `STP_NOTIFICA_SISTEMA_CUSTOM` (parâmetro `P_CODGRUPO`).
Hoje é placeholder `0` na constante `CODGRUPO_DP` do `.java`.

**Como resolver:** consultar a tela de Grupos de Usuário no Sankhya, ou a
tabela `TSIGRU`, com o administrador do ambiente.
