package br.com.voke.rh.ferias;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.cuckoo.core.ScheduledAction;
import org.cuckoo.core.ScheduledActionContext;

import br.com.sankhya.jape.core.JapeSession;
import br.com.sankhya.jape.core.JapeSession.SessionHandle;
import br.com.sankhya.jape.dbproc.JdbcWrapper;
import br.com.sankhya.jape.dbproc.NativeSql;

/**
 * Notifica o DP via sininho (TSIAVI) quando colaboradores entram na
 * janela crítica de férias a vencer (90 dias de antecedência).
 *
 * Configurar DUAS Ações Agendadas no Sankhya apontando para esta classe,
 * cada uma com o parâmetro "modo" diferente:
 *   - Ação DIÁRIA  → modo=DIFF     (só quem é novo na janela)
 *   - Ação MENSAL  → modo=COMPLETO (todos na janela, relatório)
 *
 * Pré-requisitos de banco:
 *   1. VW_ALERTA_FERIAS_A_VENCER      (sql/vw_alerta_ferias_a_vencer.sql)
 *   2. AD_FERIAS_NOTIFICADO           (sql/ad_ferias_notificado.sql)
 *   3. STP_NOTIFICA_SISTEMA_CUSTOM    (sql/stp_notifica_sistema_custom.sql)
 */
public class AlertaFeriasNotificacao implements ScheduledAction {

    private static final int IMPORTANCIA_URGENTISSIMO = 0;
    private static final int CODUSU_SISTEMA = -1;

    // ------------------------------------------------------------------
    // PONTO DE ENTRADA
    // O parâmetro "modo" é configurado em cada Ação Agendada no Sankhya.
    // ------------------------------------------------------------------
    @Override
    public void execute(ScheduledActionContext ctx) throws Exception {
        String modo = ctx.getParameter("modo") != null
                ? ctx.getParameter("modo").toString()
                : "DIFF";
        executarRotina(modo);
    }

    private void executarRotina(String modo) {
        log("=== Iniciando modo=" + modo + " ===");

        List<FuncionarioAlerta> todos = buscarAlertas();
        log("Na janela (bruto): " + todos.size());

        List<FuncionarioAlerta> deduplicados = agruparPorFuncionario(todos);
        log("Após deduplicação: " + deduplicados.size());

        List<FuncionarioAlerta> aNotificar;
        if ("COMPLETO".equals(modo)) {
            aNotificar = deduplicados;
        } else {
            aNotificar = filtrarNaoNotificados(deduplicados);
            log("Novos (DIFF): " + aNotificar.size());
        }

        if (aNotificar.isEmpty()) {
            log("Nenhum novo alerta. Encerrando.");
            return;
        }

        String titulo = "COMPLETO".equals(modo)
                ? "Férias a vencer — relatório mensal"
                : "Férias a vencer — novo alerta";

        for (FuncionarioAlerta f : aNotificar) {
            notificarSino(titulo, montarDescricao(f));
        }
        log("Sinos enviados: " + aNotificar.size());

        if (!"COMPLETO".equals(modo)) {
            registrarNotificados(aNotificar);
            log("Registrados em AD_FERIAS_NOTIFICADO: " + aNotificar.size());
        }

        log("=== Concluído ===");
    }

    // ------------------------------------------------------------------
    // DTO
    // ------------------------------------------------------------------
    private static class FuncionarioAlerta {
        int       codEmp;
        int       codFunc;
        int       sequencia;
        String    nomeFunc;
        String    descrDep;
        String    razaoSocial;
        Timestamp limGozo;
        long      diasParaVencer;
    }

    // ------------------------------------------------------------------
    // BUSCA
    // ------------------------------------------------------------------
    private List<FuncionarioAlerta> buscarAlertas() {
        List<FuncionarioAlerta> lista = new ArrayList<FuncionarioAlerta>();

        String sql = "SELECT CODEMP, CODFUNC, SEQUENCIA, NOMEFUNC, DESCRDEP, "
                   + "       RAZAOSOCIAL, LIMGOZO, "
                   + "       (LIMGOZO - TRUNC(SYSDATE)) AS DIAS_PARA_VENCER "
                   + "FROM VW_ALERTA_FERIAS_A_VENCER";

        SessionHandle sessao = JapeSession.open();
        try {
            ResultSet rs = NativeSql.queryNative(sessao, sql).getResultSet();
            while (rs.next()) {
                FuncionarioAlerta f = new FuncionarioAlerta();
                f.codEmp         = rs.getInt("CODEMP");
                f.codFunc        = rs.getInt("CODFUNC");
                f.sequencia      = rs.getInt("SEQUENCIA");
                f.nomeFunc       = rs.getString("NOMEFUNC");
                f.descrDep       = rs.getString("DESCRDEP");
                f.razaoSocial    = rs.getString("RAZAOSOCIAL");
                f.limGozo        = rs.getTimestamp("LIMGOZO");
                f.diasParaVencer = rs.getLong("DIAS_PARA_VENCER");
                lista.add(f);
            }
        } catch (Exception e) {
            throw new RuntimeException("Erro ao consultar VW_ALERTA_FERIAS_A_VENCER", e);
        } finally {
            sessao.close();
        }

        return lista;
    }

    // ------------------------------------------------------------------
    // DEDUPLICAÇÃO
    // Mantém só o período mais urgente por funcionário.
    // ------------------------------------------------------------------
    private List<FuncionarioAlerta> agruparPorFuncionario(List<FuncionarioAlerta> lista) {
        Map<String, FuncionarioAlerta> mapa = new LinkedHashMap<String, FuncionarioAlerta>();

        for (FuncionarioAlerta f : lista) {
            String chave = f.codEmp + "-" + f.codFunc;
            FuncionarioAlerta atual = mapa.get(chave);
            if (atual == null || f.diasParaVencer < atual.diasParaVencer) {
                mapa.put(chave, f);
            }
        }

        return new ArrayList<FuncionarioAlerta>(mapa.values());
    }

    // ------------------------------------------------------------------
    // FILTRO DIFF
    // ------------------------------------------------------------------
    private List<FuncionarioAlerta> filtrarNaoNotificados(List<FuncionarioAlerta> lista) {
        if (lista.isEmpty()) return lista;

        Set<String> jaNotificados = new HashSet<String>();
        String sql = "SELECT CODEMP, CODFUNC, SEQUENCIA FROM AD_FERIAS_NOTIFICADO";

        SessionHandle sessao = JapeSession.open();
        try {
            ResultSet rs = NativeSql.queryNative(sessao, sql).getResultSet();
            while (rs.next()) {
                jaNotificados.add(
                    rs.getInt("CODEMP") + "-" + rs.getInt("CODFUNC") + "-" + rs.getInt("SEQUENCIA")
                );
            }
        } catch (Exception e) {
            throw new RuntimeException("Erro ao consultar AD_FERIAS_NOTIFICADO", e);
        } finally {
            sessao.close();
        }

        List<FuncionarioAlerta> novos = new ArrayList<FuncionarioAlerta>();
        for (FuncionarioAlerta f : lista) {
            if (!jaNotificados.contains(f.codEmp + "-" + f.codFunc + "-" + f.sequencia)) {
                novos.add(f);
            }
        }
        return novos;
    }

    // ------------------------------------------------------------------
    // REGISTRO (modo DIFF)
    // WHERE NOT EXISTS garante idempotência.
    // ------------------------------------------------------------------
    private void registrarNotificados(List<FuncionarioAlerta> lista) {
        String sql = "INSERT INTO AD_FERIAS_NOTIFICADO (CODEMP, CODFUNC, SEQUENCIA, DTNOTIFICACAO) "
                   + "SELECT ?, ?, ?, SYSDATE FROM DUAL "
                   + "WHERE NOT EXISTS ("
                   + "  SELECT 1 FROM AD_FERIAS_NOTIFICADO "
                   + "  WHERE CODEMP = ? AND CODFUNC = ? AND SEQUENCIA = ?"
                   + ")";

        SessionHandle sessao = JapeSession.open();
        try {
            for (FuncionarioAlerta f : lista) {
                JdbcWrapper.executeNative(sessao, sql,
                        f.codEmp, f.codFunc, f.sequencia,
                        f.codEmp, f.codFunc, f.sequencia);
            }
        } catch (Exception e) {
            throw new RuntimeException("Erro ao registrar em AD_FERIAS_NOTIFICADO", e);
        } finally {
            sessao.close();
        }
    }

    // ------------------------------------------------------------------
    // SININHO — chama STP_NOTIFICA_SISTEMA_CUSTOM
    // P_CODGRUPO não é passado pelo Java — a procedure tem o código fixo.
    // ------------------------------------------------------------------
    private void notificarSino(String titulo, String descricao) {
        String sql = "BEGIN STP_NOTIFICA_SISTEMA_CUSTOM("
                   + "  P_TITULO          => ?, "
                   + "  P_DESCRICAO       => ?, "
                   + "  P_CODUSU          => NULL, "
                   + "  P_CODUSUREMETENTE => ?, "
                   + "  P_IMPORTANCIA     => ?); END;";

        SessionHandle sessao = JapeSession.open();
        try {
            JdbcWrapper.executeNative(sessao, sql,
                    titulo, descricao, CODUSU_SISTEMA, IMPORTANCIA_URGENTISSIMO);
        } catch (Exception e) {
            throw new RuntimeException("Erro ao enviar sininho: " + descricao, e);
        } finally {
            sessao.close();
        }
    }

    // ------------------------------------------------------------------
    // FORMATAÇÃO
    // ------------------------------------------------------------------
    private String montarDescricao(FuncionarioAlerta f) {
        String dataFormatada = new SimpleDateFormat("dd/MM/yyyy").format(f.limGozo);
        return f.nomeFunc
             + " (" + f.razaoSocial + " — " + f.descrDep + ")"
             + " | Férias vencem em " + f.diasParaVencer + " dia(s)"
             + " (limite: " + dataFormatada + ")";
    }

    private void log(String msg) {
        System.out.println("[AlertaFerias] " + msg);
    }
}
