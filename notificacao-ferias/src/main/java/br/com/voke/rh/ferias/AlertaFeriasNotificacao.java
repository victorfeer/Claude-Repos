/* ============================================================================
   AlertaFeriasNotificacao.java

   STATUS DESTE ARQUIVO: RECONSTITUÍDO A PARTIR DE HISTÓRICO DE CONVERSAS.
   Este código NÃO foi salvo em sua forma final consolidada em nenhuma
   sessão anterior -- ele foi montado por uma sequência de patches
   (str_replace) ao longo de uma conversa longa, e nunca reescrito do
   zero depois de "fechado". A reconstituição abaixo junta os trechos
   confirmados encontrados em busca, mas os métodos marcados com
   "[RECONSTITUÍDO -- REVISAR]" precisam de revisão linha a linha contra
   qualquer cópia que ainda exista do código antes de ir para produção.

   INCERTEZAS HERDADAS DO PROJETO ORIGINAL (não resolvidas, ver pendência
   do usuário em 26/06/2026 -- nenhuma das 3 abaixo foi validada ainda):

   [1] Assinatura real da interface ScheduledAction do Cuckoo.jar -- não
       documentada publicamente. Confirmar abrindo o jar no ambiente real
       (ver seção "Como descobrir a assinatura real" no README.md).
   [2] Mecanismo real de envio de e-mail a partir de uma ScheduledAction
       (fora do contexto de botão/AcaoRotinaJava) -- ainda é TODO/hipótese.
       O recurso de e-mail documentado oficialmente é amarrado ao contexto
       de AcaoRotinaJava (ContextoAcao "agendar envio de email"); o
       equivalente para rotina agendada pura não foi confirmado.
   [3] CODGRUPO_DP -- código do grupo de key users do DP no Sankhya.
       Placeholder em 0. Preencher com o código real do grupo.

   OUTRAS INCERTEZAS DO ESQUELETO ORIGINAL (mantidas como estavam):
   [4] Descricao da STP_NOTIFICA_SISTEMA: documentação afirma que deve
       ser montada via GET_LINK_TELA(ResourceID, textoLink, JsonPk), mas
       não confirma se aceita ResourceID/JsonPk nulos para aviso "sem
       destino". Tratado abaixo com fallback de texto simples -- TESTAR.
   [5] Chamada de STP_NOTIFICA_SISTEMA a partir de Java: assumida aqui via
       JdbcWrapper/NativeSql como chamada de procedure. Confirmar se
       EntityFacade ou outro helper interno já encapsula isso de forma
       mais segura no ambiente.
   [6] EmailHelper.enviar(...) abaixo é um helper HIPOTÉTICO -- não existe
       confirmação de que essa classe existe no ambiente. Substituir pelo
       mecanismo real depois de resolver a incerteza [2].

   DECISÕES DE NEGÓCIO JÁ FECHADAS COM O KEY USER (essas são confiáveis):
   - Um aviso de sininho POR COLABORADOR (não uma lista concatenada),
     para não gerar um bloco de texto longo demais dentro do aviso.
   - O e-mail pode seguir concatenado (lista inteira em um corpo só).
   - Dois modos de execução: "DIFF" (diário, só quem é novo na janela)
     e "COMPLETO" (mensal, relatório cheio, não marca como notificado).
   - Deduplicação por funcionário: quando o mesmo CODFUNC aparece em mais
     de um período de férias na janela, mantém-se só o de menor
     diasParaVencer (mais urgente) -- evita dois avisos iguais pra mesma
     pessoa.
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

// Import de referência -- confirmar pacote exato do Cuckoo.jar no ambiente (incerteza [1])
// import br.com.sankhya.scheduler.ScheduledAction;
// import br.com.sankhya.scheduler.SchedulerContext; // nome hipotético, validar

import br.com.sankhya.jape.core.JapeSession;
import br.com.sankhya.jape.core.JapeSession.SessionHandle;
import br.com.sankhya.jape.dbproc.NativeSql;
import br.com.sankhya.jape.dbproc.JdbcWrapper;

public class AlertaFeriasNotificacao /* implements ScheduledAction */ {

    // ------------------------------------------------------------------
    // CONFIGURAÇÃO -- ajustar conforme decisões já fechadas com o key user
    // ------------------------------------------------------------------

    /** Código do grupo de key users do DP cadastrado no Sankhya (CODGRUPO). */
    private static final int CODGRUPO_DP = 0; // TODO [3]: preencher com o código real do grupo

    /** Usuário remetente do aviso. -1 é o padrão observado para "Sistema". */
    private static final int CODUSU_REMETENTE_SISTEMA = -1;

    /** Janela de antecedência em dias, fechada na reunião com o key user. */
    private static final int JANELA_DIAS_ALERTA = 90;

    // ------------------------------------------------------------------
    // DTO interno -- representa uma linha de retorno da VW_ALERTA_FERIAS_A_VENCER
    // [RECONSTITUÍDO -- REVISAR] campos inferidos a partir do uso nos métodos
    // abaixo; confirmar contra a view se algum campo foi renomeado depois.
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
    // PONTO DE ENTRADA -- assinatura real depende da incerteza [1].
    // [RECONSTITUÍDO -- REVISAR] mantido como método comum por enquanto;
    // ajustar para o método de interface real (execute/run/onSchedule?)
    // quando a assinatura de ScheduledAction for confirmada.
    // ------------------------------------------------------------------
    public void executarRotina(String modoExecucao /* "DIFF" ou "COMPLETO" */) {
        List<FuncionarioAlerta> linhas = buscarAlertas();
        List<FuncionarioAlerta> porFuncionario = agruparPorFuncionario(linhas);

        List<FuncionarioAlerta> alertasParaNotificar;
        if ("COMPLETO".equals(modoExecucao)) {
            alertasParaNotificar = porFuncionario; // relatório mensal: todo mundo na janela
        } else {
            alertasParaNotificar = filtrarAindaNaoNotificados(porFuncionario); // TODO: tabela auxiliar (ver final do arquivo)
        }

        if (alertasParaNotificar.isEmpty()) {
            return; // nada novo para notificar hoje
        }

        String tituloEmail = "COMPLETO".equals(modoExecucao)
                ? "Relatório mensal - Férias a vencer"
                : "Novo alerta de férias a vencer";

        // O e-mail segue concatenado (cabe bem num corpo de e-mail).
        String corpoEmail = montarCorpoEmail(alertasParaNotificar, modoExecucao);
        enviarEmail(tituloEmail, corpoEmail); // TODO [2][6]: mecanismo real de envio

        // O sininho recebe um aviso individual por colaborador.
        for (FuncionarioAlerta item : alertasParaNotificar) {
            String tituloAviso = "COMPLETO".equals(modoExecucao)
                    ? "Férias a vencer (relatório mensal)"
                    : "Férias a vencer";
            String descricaoAviso = montarDescricaoAviso(item);
            enviarNotificacaoSino(tituloAviso, descricaoAviso);
        }

        if (!"COMPLETO".equals(modoExecucao)) {
            registrarComoNotificados(alertasParaNotificar);
        }
    }

    // ------------------------------------------------------------------
    // BUSCA -- [RECONSTITUÍDO -- REVISAR] implementação não encontrada em
    // forma final nos resultados de busca. Esqueleto abaixo é o padrão
    // de leitura via NativeSql/JdbcWrapper já confirmado em outras partes
    // do projeto (ver incerteza [5]), aplicado contra a view já validada.
    // ------------------------------------------------------------------
    private List<FuncionarioAlerta> buscarAlertas() {
        List<FuncionarioAlerta> resultado = new ArrayList<FuncionarioAlerta>();

        String sql = "SELECT CODEMP, CODFUNC, SEQUENCIA, NOMEFUNC, DESCRDEP, RAZAOSOCIAL, LIMGOZO, "
                   + "       (LIMGOZO - TRUNC(SYSDATE)) AS DIAS_PARA_VENCER "
                   + "FROM VW_ALERTA_FERIAS_A_VENCER";

        // TODO [RECONSTITUÍDO]: confirmar padrão real de abertura de sessão/
        // execução de NativeSql usado no restante do projeto Sankhya deste
        // cliente -- abaixo é só a forma genérica documentada.
        SessionHandle session = JapeSession.open();
        try {
            ResultSet rs = NativeSql.queryNative(session, sql).getResultSet();
            while (rs.next()) {
                FuncionarioAlerta item = new FuncionarioAlerta();
                item.codEmp = rs.getInt("CODEMP");
                item.codFunc = rs.getInt("CODFUNC");
                item.sequencia = rs.getInt("SEQUENCIA");
                item.nomeFunc = rs.getString("NOMEFUNC");
                item.descrDep = rs.getString("DESCRDEP");
                item.razaoSocial = rs.getString("RAZAOSOCIAL");
                item.limGozo = rs.getTimestamp("LIMGOZO");
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
    // DEDUPLICAÇÃO POR FUNCIONÁRIO -- CONFIRMADO
    // A query traz uma linha por período de férias. Quando o mesmo
    // CODFUNC aparece em mais de uma linha, mantém-se apenas UMA linha
    // representante -- a de menor diasParaVencer (período mais urgente).
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
    // FILTRO "AINDA NÃO NOTIFICADO"
    // Consulta AD_FERIAS_NOTIFICADO e exclui quem já foi notificado para
    // o mesmo período (CODEMP + CODFUNC + SEQUENCIA). A tabela deve ser
    // criada antes de ativar o modo DIFF (ver sql/ad_ferias_notificado.sql).
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
    // REGISTRO DE NOTIFICADOS
    // INSERT em AD_FERIAS_NOTIFICADO para cada funcionário notificado.
    // PK (CODEMP, CODFUNC, SEQUENCIA) garante idempotência: se a rotina
    // rodar duas vezes no mesmo dia por erro operacional, o segundo INSERT
    // falha silenciosamente em vez de duplicar o alerta.
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
            throw new RuntimeException("Falha ao registrar notificados em AD_FERIAS_NOTIFICADO", e);
        } finally {
            session.close();
        }
    }

    // ------------------------------------------------------------------
    // MONTAGEM DA MENSAGEM -- E-MAIL (lista completa) -- CONFIRMADO
    // ------------------------------------------------------------------
    private String montarCorpoEmail(List<FuncionarioAlerta> itens, String modo) {
        StringBuilder sb = new StringBuilder();
        sb.append("COMPLETO".equals(modo)
                ? "Relatório mensal de funcionários com férias a vencer:\n\n"
                : "Novo(s) funcionário(s) entrou(aram) na janela crítica de férias a vencer:\n\n");

        for (FuncionarioAlerta item : itens) {
            sb.append("- ").append(formatarLinhaColaborador(item)).append("\n");
        }
        return sb.toString();
    }

    // ------------------------------------------------------------------
    // MONTAGEM DA MENSAGEM -- SININHO (um aviso por colaborador) -- CONFIRMADO
    // Sem link de destino por enquanto (ver incerteza [4] sobre GET_LINK_TELA).
    // ------------------------------------------------------------------
    private String montarDescricaoAviso(FuncionarioAlerta item) {
        return formatarLinhaColaborador(item);
    }

    /**
     * Formato único reaproveitado no e-mail (uma linha por item) e no
     * sininho (uma Descricao por aviso): nome + departamento/empresa +
     * dias para vencer + data limite.
     * [RECONSTITUÍDO -- REVISAR]: a formatação exata da string final
     * (texto literal) não foi encontrada 100% fechada nos resultados de
     * busca -- o formato abaixo segue o padrão geral descrito ("nome +
     * situação de cada colaborador"), mas o texto literal pode precisar
     * de ajuste fino comparado ao que foi efetivamente fechado.
     */
    private String formatarLinhaColaborador(FuncionarioAlerta item) {
        return item.nomeFunc
                + " (" + item.razaoSocial + " - " + item.descrDep + ")"
                + " - férias vencem em " + item.diasParaVencer + " dia(s)"
                + " (venc. " + item.limGozo + ")";
    }

    // ------------------------------------------------------------------
    // ENVIO DE E-MAIL -- TODO [2][6], incerteza não resolvida
    // ------------------------------------------------------------------
    private void enviarEmail(String titulo, String corpo) {
        // TODO: mecanismo real de envio de e-mail a partir de uma rotina
        // agendada (fora do contexto de botão/AcaoRotinaJava) ainda não
        // confirmado. EmailHelper abaixo é HIPOTÉTICO.
        // EmailHelper.enviar(titulo, corpo, listaDestinatariosDP);
        throw new UnsupportedOperationException(
            "Mecanismo de envio de e-mail fora do contexto de botão ainda não confirmado (incerteza [2]).");
    }

    // ------------------------------------------------------------------
    // ENVIO DE NOTIFICAÇÃO NO SININHO -- CONFIRMADO (via procedure)
    // Chama STP_NOTIFICA_SISTEMA_CUSTOM (ver sql/stp_notifica_sistema_custom.sql).
    // ------------------------------------------------------------------
    private void enviarNotificacaoSino(String titulo, String descricao) {
        String sql = "BEGIN STP_NOTIFICA_SISTEMA_CUSTOM("
                   + "P_TITULO => ?, P_DESCRICAO => ?, P_CODUSU => NULL, "
                   + "P_CODGRUPO => ?, P_CODUSUREMETENTE => ?, P_IMPORTANCIA => 0); END;";

        // TODO [RECONSTITUÍDO]: confirmar a forma real de chamar uma procedure
        // PL/SQL (com parâmetros nomeados) via JdbcWrapper neste ambiente --
        // abaixo é a forma genérica, não validada em produção.
        SessionHandle session = JapeSession.open();
        try {
            JdbcWrapper.executeNative(session, sql, titulo, descricao, CODGRUPO_DP, CODUSU_REMETENTE_SISTEMA);
        } catch (Exception e) {
            throw new RuntimeException("Falha ao notificar sininho via STP_NOTIFICA_SISTEMA_CUSTOM", e);
        } finally {
            session.close();
        }
    }
}

// DDL da tabela auxiliar de controle: ver sql/ad_ferias_notificado.sql
