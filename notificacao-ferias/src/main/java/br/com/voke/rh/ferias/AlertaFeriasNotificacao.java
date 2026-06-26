/* ============================================================================
   AlertaFeriasNotificacao.java

   ESTADO: PRONTO PARA TESTE EM AMBIENTE SANKHYA.
   Escopo: apenas notificação no sininho (TSIAVI). Sem envio de e-mail.

   ANTES DE SUBIR NO SANKHYA, resolver as 2 pendências abaixo:

   [1] ASSINATURA ScheduledAction: descomente o bloco "OPÇÃO A" ou "OPÇÃO B"
       conforme o resultado de:
           javap <caminho>/Cuckoo.jar!/br/com/sankhya/scheduler/ScheduledAction.class
       Deixe comentado o bloco que não for usado.

   [2] CODGRUPO_DP: preencher com o código real do grupo do DP.
       Consultar: SELECT CODGRUPO, DESCRGRU FROM TSIGRU WHERE DESCRGRU LIKE '%DP%'
   ============================================================================ */

package br.com.voke.rh.ferias;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

// TODO [1] -- descomente o bloco correto após inspecionar o Cuckoo.jar:
//
// OPÇÃO A (assinatura mais comum em versões antigas do Sankhya):
// import br.com.sankhya.scheduler.ScheduledAction;
// import br.com.sankhya.scheduler.SchedulerContext;
//
// OPÇÃO B (assinatura encontrada em algumas versões mais recentes):
// import br.com.sankhya.actionbutton.ContextoAcao;

import br.com.sankhya.jape.core.JapeSession;
import br.com.sankhya.jape.core.JapeSession.SessionHandle;
import br.com.sankhya.jape.dbproc.JdbcWrapper;
import br.com.sankhya.jape.dbproc.NativeSql;

// TODO [1] -- descomente a assinatura correta e remova esta linha de declaração:
public class AlertaFeriasNotificacao {

// OPÇÃO A:
// public class AlertaFeriasNotificacao implements br.com.sankhya.scheduler.ScheduledAction {

// OPÇÃO B:
// public class AlertaFeriasNotificacao implements br.com.sankhya.actionbutton.AcaoRotinaJava {

    // ------------------------------------------------------------------
    // CONFIGURAÇÃO
    // ------------------------------------------------------------------

    /** TODO [2]: preencher com o código real do grupo do DP no Sankhya.
     *  SELECT CODGRUPO, DESCRGRU FROM TSIGRU WHERE DESCRGRU LIKE '%DP%' */
    private static final int CODGRUPO_DP = 0;

    /** -1 = usuário "Sistema" (padrão Sankhya para avisos automáticos). */
    private static final int CODUSU_REMETENTE_SISTEMA = -1;

    // ------------------------------------------------------------------
    // PONTO DE ENTRADA -- ScheduledAction (Ação Agendada)
    //
    // Configure DUAS Ações Agendadas separadas no Sankhya, apontando para
    // esta mesma classe, com parâmetros diferentes:
    //   Ação A (diária)  → chama executarRotina("DIFF")
    //   Ação B (mensal)  → chama executarRotina("COMPLETO")
    //
    // TODO [1]: quando a assinatura real for confirmada, substituir este
    // método pelo método da interface (ex: execute, run, onSchedule...).
    // O parâmetro modoExecucao deve vir do contexto da Ação Agendada.
    // ------------------------------------------------------------------
    public void executarRotina(String modoExecucao) {
        log("=== Iniciando AlertaFeriasNotificacao modo=" + modoExecucao + " ===");

        List<FuncionarioAlerta> linhas = buscarAlertas();
        log("Funcionários na janela (antes da deduplicação): " + linhas.size());

        List<FuncionarioAlerta> porFuncionario = agruparPorFuncionario(linhas);
        log("Após deduplicação por funcionário: " + porFuncionario.size());

        List<FuncionarioAlerta> alertasParaNotificar;
        if ("COMPLETO".equals(modoExecucao)) {
            alertasParaNotificar = porFuncionario;
        } else {
            alertasParaNotificar = filtrarAindaNaoNotificados(porFuncionario);
            log("Novos a notificar (modo DIFF): " + alertasParaNotificar.size());
        }

        if (alertasParaNotificar.isEmpty()) {
            log("Nenhum novo alerta para enviar. Encerrando.");
            return;
        }

        String tituloAviso = "COMPLETO".equals(modoExecucao)
                ? "Férias a vencer (relatório mensal)"
                : "Férias a vencer";

        int sinosEnviados = 0;
        for (FuncionarioAlerta item : alertasParaNotificar) {
            String descricaoAviso = montarDescricaoAviso(item);
            enviarNotificacaoSino(tituloAviso, descricaoAviso);
            sinosEnviados++;
        }
        log("Sinosisses enviados: " + sinosEnviados);

        if (!"COMPLETO".equals(modoExecucao)) {
            registrarComoNotificados(alertasParaNotificar);
            log("Registrados em AD_FERIAS_NOTIFICADO: " + alertasParaNotificar.size());
        }

        log("=== AlertaFeriasNotificacao concluído ===");
    }

    // ------------------------------------------------------------------
    // DTO
    // ------------------------------------------------------------------
    public static class FuncionarioAlerta {
        public int codEmp;
        public int codFunc;
        public int sequencia;
        public String nomeFunc;
        public String descrDep;
        public String razaoSocial;
        public Timestamp limGozo;
        public long diasParaVencer;
    }

    // ------------------------------------------------------------------
    // BUSCA
    // ------------------------------------------------------------------
    private List<FuncionarioAlerta> buscarAlertas() {
        List<FuncionarioAlerta> resultado = new ArrayList<FuncionarioAlerta>();

        String sql = "SELECT CODEMP, CODFUNC, SEQUENCIA, NOMEFUNC, DESCRDEP, RAZAOSOCIAL, LIMGOZO, "
                   + "       (LIMGOZO - TRUNC(SYSDATE)) AS DIAS_PARA_VENCER "
                   + "FROM VW_ALERTA_FERIAS_A_VENCER";

        SessionHandle session = JapeSession.open();
        try {
            ResultSet rs = NativeSql.queryNative(session, sql).getResultSet();
            while (rs.next()) {
                FuncionarioAlerta item = new FuncionarioAlerta();
                item.codEmp        = rs.getInt("CODEMP");
                item.codFunc       = rs.getInt("CODFUNC");
                item.sequencia     = rs.getInt("SEQUENCIA");
                item.nomeFunc      = rs.getString("NOMEFUNC");
                item.descrDep      = rs.getString("DESCRDEP");
                item.razaoSocial   = rs.getString("RAZAOSOCIAL");
                item.limGozo       = rs.getTimestamp("LIMGOZO");
                item.diasParaVencer = rs.getLong("DIAS_PARA_VENCER");
                resultado.add(item);
            }
        } catch (Exception e) {
            throw new RuntimeException("Falha ao consultar VW_ALERTA_FERIAS_A_VENCER", e);
        } finally {
            session.close();
        }

        return resultado;
    }

    // ------------------------------------------------------------------
    // DEDUPLICAÇÃO -- mantém só o período mais urgente por funcionário
    // ------------------------------------------------------------------
    private List<FuncionarioAlerta> agruparPorFuncionario(List<FuncionarioAlerta> linhas) {
        Map<String, FuncionarioAlerta> porChave = new LinkedHashMap<String, FuncionarioAlerta>();

        for (FuncionarioAlerta item : linhas) {
            String chave = item.codEmp + "-" + item.codFunc;
            FuncionarioAlerta existente = porChave.get(chave);
            if (existente == null || item.diasParaVencer < existente.diasParaVencer) {
                porChave.put(chave, item);
            }
        }

        return new ArrayList<FuncionarioAlerta>(porChave.values());
    }

    // ------------------------------------------------------------------
    // FILTRO DIFF -- exclui quem já foi notificado para o mesmo período
    // ------------------------------------------------------------------
    private List<FuncionarioAlerta> filtrarAindaNaoNotificados(List<FuncionarioAlerta> itens) {
        if (itens.isEmpty()) {
            return itens;
        }

        Set<String> jaNotificados = new HashSet<String>();
        String sql = "SELECT CODEMP, CODFUNC, SEQUENCIA FROM AD_FERIAS_NOTIFICADO";

        SessionHandle session = JapeSession.open();
        try {
            ResultSet rs = NativeSql.queryNative(session, sql).getResultSet();
            while (rs.next()) {
                String chave = rs.getInt("CODEMP") + "-" + rs.getInt("CODFUNC") + "-" + rs.getInt("SEQUENCIA");
                jaNotificados.add(chave);
            }
        } catch (Exception e) {
            throw new RuntimeException("Falha ao consultar AD_FERIAS_NOTIFICADO", e);
        } finally {
            session.close();
        }

        List<FuncionarioAlerta> novos = new ArrayList<FuncionarioAlerta>();
        for (FuncionarioAlerta item : itens) {
            String chave = item.codEmp + "-" + item.codFunc + "-" + item.sequencia;
            if (!jaNotificados.contains(chave)) {
                novos.add(item);
            }
        }
        return novos;
    }

    // ------------------------------------------------------------------
    // REGISTRO -- grava quem foi notificado (modo DIFF)
    // WHERE NOT EXISTS garante idempotência se a rotina rodar duas vezes
    // ------------------------------------------------------------------
    private void registrarComoNotificados(List<FuncionarioAlerta> itens) {
        String sql = "INSERT INTO AD_FERIAS_NOTIFICADO (CODEMP, CODFUNC, SEQUENCIA, DTNOTIFICACAO) "
                   + "SELECT ?, ?, ?, SYSDATE FROM DUAL "
                   + "WHERE NOT EXISTS ("
                   + "  SELECT 1 FROM AD_FERIAS_NOTIFICADO "
                   + "  WHERE CODEMP = ? AND CODFUNC = ? AND SEQUENCIA = ?"
                   + ")";

        SessionHandle session = JapeSession.open();
        try {
            for (FuncionarioAlerta item : itens) {
                JdbcWrapper.executeNative(session, sql,
                        item.codEmp, item.codFunc, item.sequencia,
                        item.codEmp, item.codFunc, item.sequencia);
            }
        } catch (Exception e) {
            throw new RuntimeException("Falha ao registrar em AD_FERIAS_NOTIFICADO", e);
        } finally {
            session.close();
        }
    }

    // ------------------------------------------------------------------
    // MONTAGEM -- sininho (um por colaborador)
    // ------------------------------------------------------------------
    private String montarDescricaoAviso(FuncionarioAlerta item) {
        return formatarLinhaColaborador(item);
    }

    private String formatarLinhaColaborador(FuncionarioAlerta item) {
        return item.nomeFunc
                + " (" + item.razaoSocial + " - " + item.descrDep + ")"
                + " - férias vencem em " + item.diasParaVencer + " dia(s)"
                + " (venc. " + item.limGozo + ")";
    }

    // ------------------------------------------------------------------
    // ENVIO DE SININHO -- via STP_NOTIFICA_SISTEMA_CUSTOM
    // ------------------------------------------------------------------
    private void enviarNotificacaoSino(String titulo, String descricao) {
        String sql = "BEGIN STP_NOTIFICA_SISTEMA_CUSTOM("
                   + "P_TITULO => ?, P_DESCRICAO => ?, P_CODUSU => NULL, "
                   + "P_CODGRUPO => ?, P_CODUSUREMETENTE => ?, P_IMPORTANCIA => 0); END;";

        SessionHandle session = JapeSession.open();
        try {
            JdbcWrapper.executeNative(session, sql,
                    titulo, descricao, CODGRUPO_DP, CODUSU_REMETENTE_SISTEMA);
        } catch (Exception e) {
            throw new RuntimeException("Falha ao notificar sininho: " + descricao, e);
        } finally {
            session.close();
        }
    }

    // ------------------------------------------------------------------
    // LOG -- imprime no console do Sankhya (visível nos logs da JVM)
    // ------------------------------------------------------------------
    private void log(String msg) {
        System.out.println("[AlertaFerias] " + msg);
    }
}
