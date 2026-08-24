# Job Java — `AlertaFeriasNotificacao`

> ## ⚠️ ERRATA — corrigido após análise do artefato real
>
> Este documento foi escrito **antes** do acesso ao artefato implantado
> (`alertaferias.jar`, projeto `AlertaFeriasHml`, classes de **10/07/2026**).
> A decompilação do jar provou que alguns pontos abaixo **não correspondem** ao
> que está em produção. As correções:
>
> | Afirmação neste documento | Realidade no artefato |
> |---|---|
> | Procedure com **6 parâmetros** (`P_CODGRUPO`) | **5 parâmetros** — `P_CODGRUPO` **não existe** |
> | Sino vai para um **grupo** (`CODGRUPO_DP = 123`) | Vai para **8 `CODUSU` individuais**: 1716, 1945, 1946, 1947, 2365, 3379, 3387, 3388 |
> | Limite de gozo = `DTFINAQUI + 330` | **`FER.DTLIMGOZFER`**, com fallback `ADD_MONTHS(DTFINAQUI, 12)` |
> | Job consome a view `VW_ALERTA_FERIAS_A_VENCER` | O job **não usa a view** — tem SQL próprio, com regras diferentes |
> | Chave da `AD_FERIAS_NOTIFICADO` | `(CODEMP, CODFUNC, **SEQUENCIA**)` |
> | Pendências bloqueantes: interface Cuckoo e datasource JNDI | **Resolvidas**: `org.cuckoo.core.ScheduledAction` / `onTime(ScheduledActionContext)`; conexão vem do runtime do agendador **por reflexão** |
>
> **Fontes autoritativas:** [`divergencia-view-x-job.md`](divergencia-view-x-job.md),
> os scripts em [`../sql/`](../sql) e o código em [`../fonte-java/`](../fonte-java).


Ação Agendada (Cuckoo) do Sankhya, cadastro único com gatilho **CRON diário**, que dispara em três canais: **e-mail consolidado ao DP** (melhoria 03), **e-mail individual por líder** (melhoria 04) e **pop-up/sino** (via procedure nativa customizada).

> **RECONSTITUÍDO.** O Java real existe no histórico como uma sequência de patches sobre o esqueleto abaixo (troca de CODCON/CODSMTP, modo teste → produção, ajuste do agrupamento por líder). O cabeçalho e as decisões são fiéis; os métodos internos de consulta/HTML/conexão estão marcados como reconstituídos — o código-fonte definitivo vive no Azure DevOps / ambiente.

## Pontos que dependem do ambiente (CONFIRMAR)

- **[C1]** Assinatura real da interface de agendamento do `Cuckoo.jar` (o ponto de entrada de referência é `onTime()` / `executar(...)`; ajustar ao que o jar expõe).
- **[C2]** Nome JNDI do datasource.
- **[C3]** Mecanismo real de e-mail — resolvido via **fila nativa `TMDFMG`** (inserção direta), não via serviço de e-mail hipotético.
- Chamada de `STP_NOTIFICA_SISTEMA_CUSTOM` a partir do Java — via `JdbcWrapper`/`NativeSql` como chamada de procedure.

## Modos de execução

- **DIFF** (dias normais): notifica no sino apenas quem é **novo** na janela (consulta `AD_FERIAS_NOTIFICADO`).
- **COMPLETO** (último dia útil do mês): varredura de reforço, **sem** filtro de já-notificados.

## Classe (versão final de produção reconstituída)

```java
package br.com.voke.rh.ferias;

import java.sql.CallableStatement;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Types;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import javax.naming.InitialContext;
import javax.sql.DataSource;

/**
 * ============================================================================
 * AlertaFeriasNotificacao
 * ----------------------------------------------------------------------------
 * Ação Agendada (Cuckoo) que, TODO DIA, avisa sobre colaboradores com férias
 * a vencer, em três canais:
 *   - E-mail consolidado para o DP/RH            (melhoria 03)
 *   - E-mail individual por líder                (melhoria 04)
 *   - Pop-up + sininho (via procedure)           (notificação nativa)
 *
 * REGRAS APLICADAS:
 *   - Reenvio diário: envia para todos que AINDA estão na view. Quando o DP
 *     define o período, o colaborador sai da view e para de receber. Não há
 *     supressão por AD_FERIAS_NOTIFICADO no canal de e-mail.
 *   - Requisição pendente (não aprovada): continua no e-mail e no pop-up, mas
 *     NÃO vai para o sininho (usa a flag ENVIAR_SINO = 'S' da view).
 *   - Modo teste: enquanto AD_FERIAS_CONFIG.MODO_TESTE = 'S', todos os e-mails
 *     vão só para EMAIL_TESTE; o assunto mostra o destinatário real.
 *   - Agrupamento por líder: pelo E-MAIL do líder (AD_EMAILLIDER), não pelo nome.
 *
 * >>> PONTOS QUE DEPENDEM DO AMBIENTE (CONFIRMAR) <<<
 *   [C1] Assinatura real da interface de agendamento do Cuckoo.jar.
 *   [C2] Nome JNDI do datasource.
 *   [C3] Ajustar conta/servidor SMTP se o padrão do ambiente mudar.
 * ============================================================================
 */
public class AlertaFeriasNotificacao /* implements ScheduledAction  // [C1] */ {

    // CONFIG DE E-MAIL — PRODUÇÃO. Migrar para AD_FERIAS_CONFIG (recomendado).
    private static final boolean MODO_TESTE   = false;                        // PRODUÇÃO
    private static final String  EMAIL_TESTE  = "victor.ferreira@voke.tech";  // usado só se MODO_TESTE = true
    private static final String  EMAIL_DESTINATARIOS_DP =
            "karina.souza@voke.tech;departamentopessoal@voke.tech;victor.ferreira@voke.tech"; // consolidado (03)
    private static final boolean ENVIAR_POR_LIDER = true;                     // liga/desliga melhoria 04
    private static final boolean ANEXAR_CSV       = false;                    // anexa CSV no e-mail do DP

    /** Código do grupo de key users do DP (CODGRUPO). */
    private static final int CODGRUPO_DP = 123; // << CONFIRMAR valor real (TSIGRU)
    /** Usuário remetente do aviso de sino. -1 é o padrão observado para "Sistema". */
    private static final int CODUSU_REMETENTE_SISTEMA = -1;
    /** Janela de antecedência em dias, fechada com o key user. */
    private static final int JANELA_DIAS_ALERTA = 90;

    // STATUS inicial "a enviar" na fila TMDFMG. A fila tem 4 estados (Pendente/
    // amarelo, Em processo/laranja, Sucesso: Enviada/verde, Erro: Não Enviada/vermelho).
    private static final String STATUS_A_ENVIAR = "Pendente";

    // Conta/servidor SMTP — espelham um e-mail que saiu com SUCESSO no ambiente
    // (TMDFMG CODFILA=1333886, servidor 11, conta do DP).
    private static final int CODCON_EMAIL  = 0;   // observado variável (0/168/143); 0 funcionou nos envios mais recentes
    private static final int CODSMTP_EMAIL = 11;  // servidor SMTP do DP
    // (Versão anterior usava CODCON=167 / CODSMTP=10, herdado de um e-mail de
    //  relatório — trocado para 0/11 para sair pela conta real do DP.)

    // [C1] Ponto de entrada da Ação Agendada. Ajustar à interface real do Cuckoo.jar.
    public void executarRotina(/* contexto de agendamento */) {
        // 1) Lê o consolidado (mesma base da tela)
        List<AlertaFerias> alertas = consultarConsolidado();   // consolidado_dp.sql + risco de acumular
        if (alertas.isEmpty() /* && !config.enviarQuandoVazio() */) {
            log("Sem alertas na janela; nenhum e-mail enviado.");
            return;
        }
        // 2) Melhoria 03 — e-mail consolidado ao DP
        String corpoDp = montarHtmlConsolidado(alertas);       // agrupado por faixa
        byte[] csv = ANEXAR_CSV ? gerarCsv(alertas) : null;
        enviarEmail(EMAIL_DESTINATARIOS_DP, "Alerta de Férias a Vencer", corpoDp, csv);
        // 3) Melhoria 04 — e-mail por líder
        if (ENVIAR_POR_LIDER) {
            Map<String, List<AlertaFerias>> porLider = agruparPorLider(alertas); // chave = AD_EMAILLIDER
            List<String> lideresSemEmail = new ArrayList<>();
            for (Map.Entry<String, List<AlertaFerias>> e : porLider.entrySet()) {
                String emailLider = e.getKey();
                if (isVazio(emailLider)) { lideresSemEmail.add(descreverEquipe(e.getValue())); continue; }
                enviarEmail(emailLider, "Sua equipe com férias a vencer",
                            montarHtmlEquipe(e.getValue()), null);
            }
            if (!lideresSemEmail.isEmpty()) {
                enviarEmail(EMAIL_DESTINATARIOS_DP, "Líderes sem e-mail cadastrado (férias)",
                            montarHtmlLideresSemEmail(lideresSemEmail), null);
            }
        }
        // 4) Pop-up + sininho — só quem ainda não foi notificado no modo DIFF,
        //    e só quem tem ENVIAR_SINO = 'S' (exclui requisição pendente).
        chamarNotificacao(/* pop-up */ true, alertas.size());
        List<AlertaFerias> paraSino = filtrarEnviarSino(alertas);
        if (!paraSino.isEmpty()) {
            chamarNotificacao(/* pop-up */ false, paraSino.size());
            registrarComoNotificados(paraSino); // AD_FERIAS_NOTIFICADO (modo DIFF)
        }
    }

    // Envio de e-mail — ponto ÚNICO de saída: aplica o redirecionamento do modo
    // teste e enfileira na TMDFMG (um registro por destinatário).
    private void enviarEmail(String destinatarios, String assuntoBase, String corpoHtml, byte[] csv) {
        String assunto = assuntoBase;
        String destino = destinatarios;
        if (MODO_TESTE) {
            assunto = "[TESTE -> " + destinatarios + "] " + assuntoBase;
            destino = EMAIL_TESTE;
        }
        String sql =
            "INSERT INTO TMDFMG (CODFILA, DTENTRADA, STATUS, CODCON, CODSMTP, TENTENVIO, "
          + "MAXTENTENVIO, TIPOENVIO, REENVIAR, CODUSU, ASSUNTO, EMAIL, MENSAGEM) "
          + "SELECT NVL(MAX(CODFILA),0)+1, SYSDATE, ?, ?, ?, 0, 3, 'E', 'N', 0, ?, ?, ? "
          + "FROM TMDFMG";
        String[] enderecos = destino.split("[;,]");
        PreparedStatement ps = null;
        try {
            Connection conn = obterConexao(); // [C2] datasource JNDI
            ps = conn.prepareStatement(sql);
            for (String email : enderecos) {
                email = email.trim();
                if (email.length() == 0) continue;
                ps.setString(1, STATUS_A_ENVIAR);
                ps.setInt(2, CODCON_EMAIL);
                ps.setInt(3, CODSMTP_EMAIL);
                ps.setString(4, assunto);
                ps.setString(5, email);
                ps.setString(6, corpoHtml);
                ps.executeUpdate();
                log("E-mail enfileirado na TMDFMG -> " + email + " | " + assunto);
            }
        } catch (Exception ex) {
            // Isolado: falha no e-mail não interrompe a notificação de sino/pop-up.
            log("Falha ao enfileirar e-mail: " + causaCompleta(ex));
        } finally {
            fechar(ps);
        }
    }

    // Pop-up / sino — chama a procedure customizada.
    private void chamarNotificacao(boolean popup, int quantidade) {
        // JdbcWrapper/NativeSql chamando STP_NOTIFICA_SISTEMA_CUSTOM com
        // P_CODGRUPO = CODGRUPO_DP, P_CODUSUREMETENTE = CODUSU_REMETENTE_SISTEMA,
        // P_IMPORTANCIA = 0 (Urgentíssimo).
        // [RECONSTITUÍDO — a assinatura exata Java->PL/SQL depende do helper
        //  disponível no ambiente: CallableStatement direto ou wrapper JAPE.]
    }

    // DTO interno — uma linha de retorno da consulta consolidada.
    // [RECONSTITUÍDO] campos inferidos do uso; confirmar contra a view/consulta.
    private static class AlertaFerias {
        int codEmp, codFunc;
        String nomeFunc, nomeLider, emailLider;
        java.sql.Date dtFinAqui, limGozo;
        int diasParaVencer;
        String enviarSino; // 'S' / 'N'
    }
}
```

## Tratamento de erros

O envio de e-mail é **isolado por try/catch**: uma falha no e-mail **não interrompe** a notificação de sino/pop-up. Erros da rotina sobem com a **cadeia de causas concatenada** na mensagem (a tela de Ações Agendadas mostra apenas o topo da exceção).

## Descobertas de ambiente (troubleshooting real)

- **`CODCON`/`CODSMTP` da fila `TMDFMG`:** descobertos **espelhando uma linha que já saiu com sucesso** (`CODFILA=1333886`). Primeira tentativa usou `CODCON=167`/`CODSMTP=10` (herdado de um e-mail de relatório) — depois trocado para o servidor do DP (`CODSMTP=11`), com `CODCON` variável (0, 168, 143 observados em envios bem-sucedidos; **0 funcionou nos mais recentes**).
- **Tabela de contas SMTP:** `TSICON` **não existe** (ORA-00942). A forma robusta de achar `CODCON`/`CODSMTP` foi **consultar a própria `TMDFMG`** filtrando por `STATUS = 'Sucesso: Enviada'` e pelo servidor desejado, em vez de depender do nome exato da tabela de contas.
- **STATUS inicial da fila:** `'Pendente'` é o valor que o **despachante nativo** procura para processar o envio.
- O log `WARN ScheduledActionsSP.isActiveJob` é da **plataforma** (camada de Ações Agendadas), **não da customização** — não impede a execução.
