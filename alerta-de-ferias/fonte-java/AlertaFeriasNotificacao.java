/* ============================================================================
   AlertaFeriasNotificacao

   Acao Agendada (Cuckoo) do ERP Sankhya que avisa sobre colaboradores com
   ferias a vencer, em dois canais:
     - E-mail: consolidado ao DP/RH + um e-mail por lider (so a equipe dele)
     - Sininho: um aviso por colaborador, para uma lista fixa de usuarios

   PROBLEMA DE NEGOCIO: ferias nao concedidas dentro do periodo concessivo
   passam a ser devidas EM DOBRO (CLT). A rotina traz o caso a atencao do
   responsavel antes que isso ocorra.

   ----------------------------------------------------------------------------
   PROCEDENCIA DESTE ARQUIVO

   Transcrito a partir da DECOMPILACAO do artefato real de homologacao
   (alertaferias.jar, projeto Eclipse "AlertaFeriasHml", classes compiladas em
   10/07/2026). O comportamento aqui reproduz 1:1 o que esta implantado.

   Ajustes feitos em relacao a saida bruta do decompilador, apenas para tornar
   o codigo compilavel e legivel -- sem alterar comportamento:
     - try-with-resources reescrito (o decompilador emite "try (X x = null;)",
       que nao e Java valido);
     - lacos while(i<n) reconvertidos para for-each;
     - constantes de cor e literais mantidos exatamente como no jar.

   O fonte bruto decompilado esta em docs/fonte-decompilado/ para conferencia.

   ----------------------------------------------------------------------------
   ATENCAO OPERACIONAL -- MODO_TESTE

   No jar de homologacao MODO_TESTE = true. Como e uma constante de compilacao,
   o compilador ELIMINA o ramo de producao: o bytecode redireciona TODO e-mail
   para EMAIL_TESTE, incondicionalmente. Esse jar NAO consegue enviar e-mail a
   destinatario real. Para produzir o jar de producao e preciso trocar a
   constante para false e RECOMPILAR.
   ============================================================================ */

package br.com.voke.rh.ferias;

import java.lang.reflect.Method;
import java.sql.CallableStatement;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.cuckoo.core.JobMetadata;
import org.cuckoo.core.ScheduledAction;
import org.cuckoo.core.ScheduledActionContext;
import org.cuckoo.core.SchedulerRuntime;
import org.cuckoo.core.SchedulerRuntimeDelegation;

public class AlertaFeriasNotificacao implements ScheduledAction {

    /** Importancia do aviso no sininho: 0 = Urgentissimo. */
    private static final int IMPORTANCIA_URGENTISSIMO = 0;

    /** Remetente do aviso. -1 = "Sistema". */
    private static final int CODUSU_SISTEMA = -1;

    /** Criterio A: entra quem esta a N dias (ou menos) do limite de gozo. */
    private static final int DIAS_LIMITE_JANELA = 30;

    /** Criterio B: aplica-se a quem tem exatamente 1 periodo aquisitivo aberto. */
    private static final int PERIODOS_ABERTOS_PREVENTIVO = 1;

    /**
     * Criterio B: piso da janela do 2o ciclo. O piso negativo evita capturar
     * registros orfaos -- periodos abertos ha anos, nunca quitados.
     */
    private static final int DIAS_PISO_JANELA = -30;

    /** Usuarios que recebem o sininho. Nao e grupo: sao CODUSU individuais. */
    private static final int[] CODUSU_DESTINATARIOS =
            new int[] { 1716, 1945, 1946, 1947, 2365, 3379, 3387, 3388 };

    /**
     * true = TODO e-mail vai apenas para EMAIL_TESTE, com o destinatario real
     * no assunto. Trocar para false e recompilar para liberar o envio real.
     */
    private static final boolean MODO_TESTE = true;

    private static final String EMAIL_TESTE = "victor.ferreira@voke.tech";

    private static final String EMAIL_DESTINATARIOS_DP =
            "karina.souza@voke.tech;departamentopessoal@voke.tech;victor.ferreira@voke.tech";

    private static final boolean ENVIAR_POR_LIDER = true;

    private static final boolean ANEXAR_CSV = false;

    /** Status inicial na fila TMDFMG; e o que o despachante nativo procura. */
    private static final String STATUS_A_ENVIAR = "Pendente";

    /** Conta de e-mail e servidor SMTP do DP na fila TMDFMG. */
    private static final int CODCON_EMAIL = 0;
    private static final int CODSMTP_EMAIL = 11;

    private static final String COR_AZUL     = "#1B3D6D";
    private static final String COR_ROSA     = "#F291D6";
    private static final String COR_CINZA    = "#595959";
    private static final String COR_BEGE     = "#E3DDC9";
    private static final String COR_VERMELHO = "#C0392B";

    // ------------------------------------------------------------------
    // Ponto de entrada da Acao Agendada
    // ------------------------------------------------------------------
    public void onTime(ScheduledActionContext ctx) {
        String modo = calcularModo();
        SchedulerRuntimeDelegation.ConnectionHolder holder = null;
        try {
            holder = obterConnectionHolder(ctx);
            Connection conn = holder.get();
            executarRotina(conn, modo);
        } catch (Exception e) {
            throw new RuntimeException(
                    "Erro ao executar AlertaFeriasNotificacao -> " + causaCompleta(e), e);
        } finally {
            if (holder != null) {
                try {
                    holder.close();
                } catch (Exception ignore) {
                    // fechar o holder nao pode mascarar o erro original
                }
            }
        }
    }

    /**
     * A tela de Acoes Agendadas mostra apenas o TOPO da excecao; sem concatenar
     * a cadeia de causas o diagnostico em producao fica cego.
     */
    private String causaCompleta(Throwable t) {
        StringBuilder sb = new StringBuilder();
        Throwable atual = t;
        while (atual != null) {
            sb.append(atual.getClass().getSimpleName())
              .append(": ").append(atual.getMessage()).append(" | ");
            atual = atual.getCause();
        }
        return sb.toString();
    }

    /**
     * Obtem a conexao do proprio runtime do agendador.
     *
     * getEnvironment() e getConnectionHolder() nao sao publicos na versao do
     * Cuckoo deste ambiente, dai o acesso por reflexao. E o unico caminho
     * encontrado para uma ScheduledAction obter conexao aqui.
     */
    private SchedulerRuntimeDelegation.ConnectionHolder obterConnectionHolder(
            ScheduledActionContext ctx) throws Exception {
        SchedulerRuntime schedulerRuntime = ctx.getSchedulerRuntime();
        Object environment = invocarMetodoOculto(schedulerRuntime, "getEnvironment");
        JobMetadata jobMetadata = ctx.getJobMetadata();
        Object holder = invocarMetodoOculto(environment, "getConnectionHolder", jobMetadata);
        return (SchedulerRuntimeDelegation.ConnectionHolder) holder;
    }

    /** Procura o metodo na classe e em toda a hierarquia, ignorando visibilidade. */
    private Object invocarMetodoOculto(Object alvo, String nomeMetodo, Object... args)
            throws Exception {
        Class<?> classeAtual = alvo.getClass();
        while (classeAtual != null) {
            Method[] metodos = classeAtual.getDeclaredMethods();
            for (int i = 0; i < metodos.length; i++) {
                Method m = metodos[i];
                if (m.getName().equals(nomeMetodo)
                        && m.getParameterTypes().length == args.length) {
                    m.setAccessible(true);
                    return m.invoke(alvo, args);
                }
            }
            classeAtual = classeAtual.getSuperclass();
        }
        throw new NoSuchMethodException(nomeMetodo + " (" + args.length
                + " parametro(s)) nao encontrado em " + alvo.getClass().getName()
                + " nem em suas superclasses");
    }

    /** COMPLETO no ultimo dia util do mes; DIFF nos demais dias. */
    private String calcularModo() {
        return isUltimoDiaUtilDoMes(new Date()) ? "COMPLETO" : "DIFF";
    }

    private boolean isUltimoDiaUtilDoMes(Date data) {
        Calendar hoje = Calendar.getInstance();
        hoje.setTime(data);

        Calendar ultimoDiaUtil = (Calendar) hoje.clone();
        ultimoDiaUtil.set(Calendar.DAY_OF_MONTH,
                ultimoDiaUtil.getActualMaximum(Calendar.DAY_OF_MONTH));

        // Recua enquanto cair em sabado ou domingo. Nao considera feriados.
        while (ultimoDiaUtil.get(Calendar.DAY_OF_WEEK) == Calendar.SATURDAY
                || ultimoDiaUtil.get(Calendar.DAY_OF_WEEK) == Calendar.SUNDAY) {
            ultimoDiaUtil.add(Calendar.DAY_OF_MONTH, -1);
        }

        return hoje.get(Calendar.DAY_OF_MONTH) == ultimoDiaUtil.get(Calendar.DAY_OF_MONTH)
            && hoje.get(Calendar.MONTH)        == ultimoDiaUtil.get(Calendar.MONTH)
            && hoje.get(Calendar.YEAR)         == ultimoDiaUtil.get(Calendar.YEAR);
    }

    // ------------------------------------------------------------------
    // Orquestracao
    // ------------------------------------------------------------------
    private void executarRotina(Connection conn, String modo) throws SQLException {
        log("=== Iniciando modo=" + modo + " ===");

        List<FuncionarioAlerta> todosNaJanela = buscarAlertas(conn);
        log("Na janela (criterio A ou B): " + todosNaJanela.size());

        // E-mail isolado: uma falha aqui nao pode impedir o sininho.
        try {
            enviarEmails(conn, todosNaJanela);
        } catch (Exception e) {
            log("Falha no envio de e-mail (sino segue normal): " + causaCompleta(e));
        }

        // Requisicao pendente continua no e-mail, mas sai do sininho: o caso ja
        // esta em tratamento, o aviso persistente viraria ruido.
        List<FuncionarioAlerta> paraSino = new ArrayList<FuncionarioAlerta>();
        for (FuncionarioAlerta f : todosNaJanela) {
            if (!f.temRequisicaoPendente) {
                paraSino.add(f);
            }
        }
        log("Elegiveis ao sino (sem requisicao pendente): " + paraSino.size());

        if (!"COMPLETO".equals(modo)) {
            paraSino = filtrarNaoNotificados(conn, paraSino);
            log("Novos (DIFF): " + paraSino.size());
        }

        if (paraSino.isEmpty()) {
            log("Nenhum alerta para o sino.");
        } else {
            for (FuncionarioAlerta f : paraSino) {
                String titulo;
                if (f.riscoAcumulo) {
                    titulo = "Férias — risco de acumular 2 períodos (CLT)";
                } else if ("COMPLETO".equals(modo)) {
                    titulo = "Férias a vencer — relatório mensal";
                } else {
                    titulo = "Férias a vencer — novo alerta";
                }
                notificarSino(conn, titulo, montarDescricao(f));
            }
            log("Sinos enviados: " + paraSino.size());

            // O modo COMPLETO e reforco mensal: NAO marca como notificado, para
            // nao suprimir o alerta diario do mes seguinte.
            if (!"COMPLETO".equals(modo)) {
                registrarNotificados(conn, paraSino);
                log("Registrados em AD_FERIAS_NOTIFICADO: " + paraSino.size());
            }
        }

        log("=== Concluído ===");
    }

    // ------------------------------------------------------------------
    // Consulta
    // ------------------------------------------------------------------
    /**
     * Elegibilidade. Entra quem atende a PELO MENOS UM criterio:
     *
     *   A) DIAS_PARA_VENCER <= 30  -- limite de gozo proximo, INCLUSIVE ja
     *      vencido (dias negativos). O alerta nao some porque o prazo passou:
     *      o passivo continua existindo.
     *
     *   B) QTD_PERIODOS_ABERTOS = 1 e o 2o ciclo completa entre -30 e +30 dias
     *      -- preventivo, antecipa o momento em que um 2o periodo acumulado
     *      seria gerado (vedado pela CLT).
     *
     * ORDEM_PERIODO = 1 mantem apenas o periodo mais ANTIGO de cada funcionario
     * (ORDER BY DTINIAQUI): a deduplicacao acontece no SQL, nao no Java.
     *
     * Limite de gozo: usa FER.DTLIMGOZFER, a coluna que o proprio Sankhya
     * calcula. Quando ela vem nula (1o periodo ainda sem limite definido),
     * cai para ADD_MONTHS(DTFINAQUI, 12).
     */
    private List<FuncionarioAlerta> buscarAlertas(Connection conn) throws SQLException {
        List<FuncionarioAlerta> lista = new ArrayList<FuncionarioAlerta>();

        String sql =
            "SELECT CODEMP, CODFUNC, SEQUENCIA, NOMEFUNC, DESCRDEP, RAZAOSOCIAL, "
          + "       LIDER, EMAIL_LIDER, "
          + "       LIMGOZO, DIAS_PARA_VENCER, DATA_LIMITE, DIAS_A_VENCER, "
          + "       QTD_PERIODOS_ABERTOS, DIAS_PARA_COMPLETAR_P2, "
          + "       TEM_REQ_PENDENTE "
          + "FROM ( "
          + "  SELECT "
          + "    FUN.CODEMP, FUN.CODFUNC, FER.SEQUENCIA, FUN.NOMEFUNC, "
          + "    DEP.DESCRDEP, EMP.RAZAOSOCIAL, "
          + "    FUN.AD_LIDER      AS LIDER, "
          + "    FUN.AD_EMAILLIDER AS EMAIL_LIDER, "
          + "    FER.DTLIMGOZFER AS LIMGOZO, "
          + "    (FER.DTLIMGOZFER - TRUNC(SYSDATE)) AS DIAS_PARA_VENCER, "
          + "    NVL(FER.DTLIMGOZFER, ADD_MONTHS(FER.DTFINAQUI, 12)) AS DATA_LIMITE, "
          + "    (NVL(FER.DTLIMGOZFER, ADD_MONTHS(FER.DTFINAQUI, 12)) - TRUNC(SYSDATE)) AS DIAS_A_VENCER, "
          + "    (ADD_MONTHS(FER.DTFINAQUI, 12) - TRUNC(SYSDATE)) AS DIAS_PARA_COMPLETAR_P2, "
          + "    ROW_NUMBER() OVER (PARTITION BY FUN.CODEMP, FUN.CODFUNC ORDER BY FER.DTINIAQUI) AS ORDEM_PERIODO, "
          + "    COUNT(*)     OVER (PARTITION BY FUN.CODEMP, FUN.CODFUNC) AS QTD_PERIODOS_ABERTOS, "
          + "    CASE WHEN EXISTS ( "
          + "           SELECT 1 FROM TFPREQ REQ "
          + "           INNER JOIN TFPREQADM ADM ON ADM.ID = REQ.ORIGEMID "
          + "           WHERE REQ.ORIGEMTIPO = 'V' "
          + "             AND REQ.CODFUNC    = FUN.CODFUNC "
          + "             AND REQ.STATUS    <> 2 "
          + "         ) THEN 'S' ELSE 'N' END AS TEM_REQ_PENDENTE "
          + "  FROM TFPFER FER "
          + "  JOIN TFPFUN FUN ON FUN.CODEMP = FER.CODEMP AND FUN.CODFUNC = FER.CODFUNC "
          + "  LEFT JOIN TFPDEP DEP ON DEP.CODDEP = FUN.CODDEP "
          + "  LEFT JOIN TSIEMP EMP ON EMP.CODEMP = FUN.CODEMP "
          + "  WHERE (FER.PERQUITADO IS NULL OR FER.PERQUITADO <> 'S') "
          + "    AND FUN.DTDEM IS NULL "
          + "    AND FUN.SITUACAO NOT IN ('0','2','8','9') "
          + ") WHERE ORDEM_PERIODO = 1 "
          + "  AND ( "
          + "    DIAS_PARA_VENCER <= ? "
          + "    OR (QTD_PERIODOS_ABERTOS = ? AND DIAS_PARA_COMPLETAR_P2 BETWEEN ? AND ?) "
          + "  )";

        PreparedStatement ps = null;
        ResultSet rs = null;
        try {
            ps = conn.prepareStatement(sql);
            ps.setInt(1, DIAS_LIMITE_JANELA);
            ps.setInt(2, PERIODOS_ABERTOS_PREVENTIVO);
            ps.setInt(3, DIAS_PISO_JANELA);
            ps.setInt(4, DIAS_LIMITE_JANELA);

            rs = ps.executeQuery();
            while (rs.next()) {
                FuncionarioAlerta f = new FuncionarioAlerta();
                f.codEmp                = rs.getInt("CODEMP");
                f.codFunc               = rs.getInt("CODFUNC");
                f.sequencia             = rs.getInt("SEQUENCIA");
                f.nomeFunc              = rs.getString("NOMEFUNC");
                f.descrDep              = rs.getString("DESCRDEP");
                f.razaoSocial           = rs.getString("RAZAOSOCIAL");
                f.lider                 = rs.getString("LIDER");
                f.emailLider            = rs.getString("EMAIL_LIDER");
                f.limGozo               = rs.getTimestamp("LIMGOZO");
                f.diasParaVencer        = rs.getLong("DIAS_PARA_VENCER");
                f.dataLimite            = rs.getTimestamp("DATA_LIMITE");
                f.diasAVencer           = rs.getLong("DIAS_A_VENCER");
                f.periodosAbertos       = rs.getInt("QTD_PERIODOS_ABERTOS");
                f.temRequisicaoPendente = "S".equals(rs.getString("TEM_REQ_PENDENTE"));

                long diasParaCompletarP2 = rs.getLong("DIAS_PARA_COMPLETAR_P2");
                f.riscoAcumulo = f.periodosAbertos == PERIODOS_ABERTOS_PREVENTIVO
                              && diasParaCompletarP2 >= DIAS_PISO_JANELA
                              && diasParaCompletarP2 <= DIAS_LIMITE_JANELA;

                lista.add(f);
            }
        } finally {
            fechar(rs);
            fechar(ps);
        }
        return lista;
    }

    // ------------------------------------------------------------------
    // Deduplicacao do sininho (modo DIFF)
    // ------------------------------------------------------------------
    private List<FuncionarioAlerta> filtrarNaoNotificados(Connection conn,
            List<FuncionarioAlerta> lista) throws SQLException {
        if (lista.isEmpty()) {
            return lista;
        }

        Set<String> jaNotificados = new HashSet<String>();
        String sql = "SELECT CODEMP, CODFUNC, SEQUENCIA FROM AD_FERIAS_NOTIFICADO";

        PreparedStatement ps = null;
        ResultSet rs = null;
        try {
            ps = conn.prepareStatement(sql);
            rs = ps.executeQuery();
            while (rs.next()) {
                jaNotificados.add(rs.getInt("CODEMP") + "-"
                                + rs.getInt("CODFUNC") + "-"
                                + rs.getInt("SEQUENCIA"));
            }
        } finally {
            fechar(rs);
            fechar(ps);
        }

        List<FuncionarioAlerta> novos = new ArrayList<FuncionarioAlerta>();
        for (FuncionarioAlerta f : lista) {
            if (!jaNotificados.contains(f.codEmp + "-" + f.codFunc + "-" + f.sequencia)) {
                novos.add(f);
            }
        }
        return novos;
    }

    /** O NOT EXISTS torna o registro idempotente em caso de reexecucao no mesmo dia. */
    private void registrarNotificados(Connection conn, List<FuncionarioAlerta> lista)
            throws SQLException {
        String sql =
            "INSERT INTO AD_FERIAS_NOTIFICADO (CODEMP, CODFUNC, SEQUENCIA, DTNOTIFICACAO) "
          + "SELECT ?, ?, ?, SYSDATE FROM DUAL "
          + "WHERE NOT EXISTS ( "
          + "  SELECT 1 FROM AD_FERIAS_NOTIFICADO "
          + "   WHERE CODEMP = ? AND CODFUNC = ? AND SEQUENCIA = ?)";

        PreparedStatement ps = null;
        try {
            ps = conn.prepareStatement(sql);
            for (FuncionarioAlerta f : lista) {
                ps.setInt(1, f.codEmp);
                ps.setInt(2, f.codFunc);
                ps.setInt(3, f.sequencia);
                ps.setInt(4, f.codEmp);
                ps.setInt(5, f.codFunc);
                ps.setInt(6, f.sequencia);
                ps.executeUpdate();
            }
        } finally {
            fechar(ps);
        }
    }

    // ------------------------------------------------------------------
    // Sininho
    // ------------------------------------------------------------------
    /**
     * Um aviso por colaborador, para cada usuario da lista de destinatarios.
     *
     * A procedure recebe CINCO parametros -- o destino e um CODUSU, nao um
     * CODGRUPO: (P_TITULO, P_DESCRICAO, P_CODUSU, P_CODUSUREMETENTE, P_IMPORTANCIA).
     *
     * Nunca inserir direto na TSIAVI: a procedure encapsula regras do sistema
     * (por exemplo o cache de notificacoes nao lidas) que um INSERT pularia.
     */
    private void notificarSino(Connection conn, String titulo, String descricao)
            throws SQLException {
        String sql = "{call STP_NOTIFICA_SISTEMA_CUSTOM(?, ?, ?, ?, ?)}";

        CallableStatement cs = null;
        try {
            cs = conn.prepareCall(sql);
            for (int i = 0; i < CODUSU_DESTINATARIOS.length; i++) {
                cs.setString(1, titulo);
                cs.setString(2, descricao);
                cs.setInt(3, CODUSU_DESTINATARIOS[i]);
                cs.setInt(4, CODUSU_SISTEMA);
                cs.setInt(5, IMPORTANCIA_URGENTISSIMO);
                cs.execute();
            }
        } finally {
            fechar(cs);
        }
    }

    // ------------------------------------------------------------------
    // E-mail
    // ------------------------------------------------------------------
    private void enviarEmails(Connection conn, List<FuncionarioAlerta> todos) throws Exception {
        if (todos.isEmpty()) {
            log("Sem alertas na janela; e-mail nao enviado.");
            return;
        }

        // Consolidado ao DP.
        String corpoDp = montarHtmlConsolidado(todos);
        byte[] csv = ANEXAR_CSV ? gerarCsv(todos) : null;
        enviar(conn, EMAIL_DESTINATARIOS_DP, "Alerta de Férias a Vencer", corpoDp, csv);

        // Um e-mail por lider, com apenas a sua equipe.
        if (ENVIAR_POR_LIDER) {
            Map<String, List<FuncionarioAlerta>> porLider = agruparPorEmailLider(todos);
            for (Map.Entry<String, List<FuncionarioAlerta>> e : porLider.entrySet()) {
                enviar(conn, e.getKey(), "Sua equipe com férias a vencer",
                       montarHtmlEquipe(e.getValue()), null);
            }
        }
    }

    /**
     * Agrupa pelo E-MAIL do lider, nunca pelo nome: nome gera ambiguidade entre
     * homonimos. Quem nao tem e-mail de lider fica de fora deste canal (segue
     * aparecendo no consolidado do DP).
     */
    private Map<String, List<FuncionarioAlerta>> agruparPorEmailLider(
            List<FuncionarioAlerta> todos) {
        Map<String, List<FuncionarioAlerta>> porLider =
                new LinkedHashMap<String, List<FuncionarioAlerta>>();
        for (FuncionarioAlerta f : todos) {
            if (isVazio(f.emailLider)) {
                continue;
            }
            String chave = f.emailLider.trim().toLowerCase();
            List<FuncionarioAlerta> equipe = porLider.get(chave);
            if (equipe == null) {
                equipe = new ArrayList<FuncionarioAlerta>();
                porLider.put(chave, equipe);
            }
            equipe.add(f);
        }
        return porLider;
    }

    /** Ponto UNICO de saida: e aqui que o modo teste desvia o destinatario. */
    private void enviar(Connection conn, String destinatarioReal, String assunto,
                        String corpoHtml, byte[] anexoCsv) throws Exception {
        String paraQuem = destinatarioReal;
        if (MODO_TESTE) {
            paraQuem = EMAIL_TESTE;
            assunto = "[TESTE -> " + destinatarioReal + "] " + assunto;
        }
        enviarEmailSankhya(conn, paraQuem, assunto, corpoHtml, anexoCsv);
    }

    /**
     * Enfileira na fila NATIVA do Sankhya (TMDFMG), um registro por destinatario.
     * O despachante nativo faz o envio SMTP e atualiza o STATUS.
     *
     * anexoCsv nao e usado nesta versao: a fila recebe apenas o corpo HTML.
     */
    private void enviarEmailSankhya(Connection conn, String destinatarios, String assunto,
                                    String corpoHtml, byte[] anexoCsv) throws Exception {
        if (isVazio(destinatarios)) {
            return;
        }

        String sql =
            "INSERT INTO TMDFMG (CODFILA, DTENTRADA, STATUS, CODCON, CODSMTP, TENTENVIO, "
          + "MAXTENTENVIO, TIPOENVIO, REENVIAR, CODUSU, ASSUNTO, EMAIL, MENSAGEM) "
          + "SELECT NVL(MAX(CODFILA),0)+1, SYSDATE, ?, ?, ?, 0, 3, 'E', 'N', 0, ?, ?, ? "
          + "FROM TMDFMG";

        String[] enderecos = destinatarios.split("[;,]");
        PreparedStatement ps = null;
        try {
            ps = conn.prepareStatement(sql);
            for (int i = 0; i < enderecos.length; i++) {
                String email = enderecos[i].trim();
                if (email.length() == 0) {
                    continue;
                }
                ps.setString(1, STATUS_A_ENVIAR);
                ps.setInt(2, CODCON_EMAIL);
                ps.setInt(3, CODSMTP_EMAIL);
                ps.setString(4, assunto);
                ps.setString(5, email);
                ps.setString(6, corpoHtml);
                ps.executeUpdate();
                log("E-mail enfileirado na TMDFMG -> " + email + " | " + assunto);
            }
        } finally {
            fechar(ps);
        }
    }

    // ------------------------------------------------------------------
    // Montagem das mensagens
    // ------------------------------------------------------------------
    private String montarHtmlConsolidado(List<FuncionarioAlerta> todos) {
        String intro = "Colaboradores com férias a vencer que ainda não tiveram o período definido:";
        return envelopeVoke("Alerta de Férias a Vencer", intro, tabela(todos));
    }

    private String montarHtmlEquipe(List<FuncionarioAlerta> equipe) {
        String intro = "Os colaboradores abaixo estão com férias a vencer. "
                     + "Providencie a definição do período junto ao RH.";
        return envelopeVoke("Sua equipe com férias a vencer", intro, tabela(equipe));
    }

    /** Envelope com a identidade visual da Voke. */
    private String envelopeVoke(String titulo, String intro, String tabela) {
        StringBuilder sb = new StringBuilder();
        sb.append("<div style=\"font-family:Arial,Helvetica,sans-serif;color:").append(COR_CINZA)
          .append(";max-width:660px;margin:0 auto;border:1px solid ").append(COR_BEGE).append(";\">");

        sb.append("<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"border-collapse:collapse;\">")
          .append("<tr><td style=\"background-color:#FFFFFF;padding:18px 24px;\">")
          .append("<span style=\"font-size:26px;font-weight:bold;letter-spacing:1px;color:")
          .append(COR_ROSA).append(";\">voke</span>")
          .append("</td></tr>")
          .append("<tr><td style=\"height:4px;background-color:").append(COR_ROSA)
          .append(";font-size:0;line-height:0;\">&nbsp;</td></tr>")
          .append("</table>");

        sb.append("<div style=\"padding:24px;\">")
          .append("<h2 style=\"color:").append(COR_AZUL).append(";font-size:20px;margin:0 0 8px 0;\">")
          .append(titulo).append("</h2>")
          .append("<p style=\"color:").append(COR_CINZA).append(";font-size:14px;margin:0 0 20px 0;\">")
          .append(intro).append("</p>")
          .append(tabela).append("</div>");

        sb.append("</div>");
        return sb.toString();
    }

    private String tabela(List<FuncionarioAlerta> lista) {
        StringBuilder sb = new StringBuilder();
        sb.append("<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" ")
          .append("style=\"border-collapse:collapse;font-size:13px;\">");

        String th = "color:#FFFFFF;text-align:left;padding:9px 10px;"
                  + "background-color:" + COR_AZUL + ";border:1px solid " + COR_AZUL + ";";
        sb.append("<tr>")
          .append("<th style=\"").append(th).append("\">Empresa</th>")
          .append("<th style=\"").append(th).append("\">Funcionário</th>")
          .append("<th style=\"").append(th).append("\">Líder</th>")
          .append("<th style=\"").append(th).append("\">Data limite</th>")
          .append("<th style=\"").append(th).append("\">Dias p/ vencer</th>")
          .append("</tr>");

        for (FuncionarioAlerta f : lista) {
            String td = "padding:8px 10px;border:1px solid " + COR_BEGE + ";";
            String tdDias = td + "font-weight:bold;color:"
                          + (f.diasAVencer < 0L ? COR_VERMELHO : COR_AZUL) + ";";
            String textoDias = f.diasAVencer < 0L
                    ? "vencido há " + Math.abs(f.diasAVencer) + " dia(s)"
                    : f.diasAVencer + " dia(s)";

            sb.append("<tr>")
              .append("<td style=\"").append(td).append("\">").append(safe(f.razaoSocial)).append("</td>")
              .append("<td style=\"").append(td).append("\">").append(safe(f.nomeFunc)).append("</td>")
              .append("<td style=\"").append(td).append("\">").append(safe(f.lider)).append("</td>")
              .append("<td style=\"").append(td).append("\">").append(fmtData(f.dataLimite)).append("</td>")
              .append("<td style=\"").append(tdDias).append("\">").append(textoDias).append("</td>")
              .append("</tr>");
        }

        sb.append("</table>");
        return sb.toString();
    }

    private byte[] gerarCsv(List<FuncionarioAlerta> todos) {
        StringBuilder sb = new StringBuilder();
        sb.append("Empresa;Funcionário;Líder;DataLimite;DiasParaVencer\n");
        for (FuncionarioAlerta f : todos) {
            sb.append(csv(f.razaoSocial)).append(';')
              .append(csv(f.nomeFunc)).append(';')
              .append(csv(f.lider)).append(';')
              .append(fmtData(f.dataLimite)).append(';')
              .append(f.diasAVencer).append('\n');
        }
        try {
            return sb.toString().getBytes("UTF-8");
        } catch (Exception e) {
            return sb.toString().getBytes();
        }
    }

    /** Texto do aviso de sininho, um por colaborador. */
    private String montarDescricao(FuncionarioAlerta f) {
        StringBuilder sb = new StringBuilder();
        sb.append(f.nomeFunc).append(" (").append(f.razaoSocial)
          .append(" — ").append(f.descrDep).append(")");

        if (f.limGozo != null) {
            sb.append(" | Férias vencem em ").append(f.diasParaVencer).append(" dia(s)")
              .append(" (limite: ").append(fmtData(f.limGozo)).append(")");
        } else {
            sb.append(" | 1º período aquisitivo ainda sem limite de gozo definido pelo sistema");
        }

        if (f.riscoAcumulo) {
            sb.append(" | ATENÇÃO: 1º período ainda não gozado e o 2º período aquisitivo ")
              .append("completa o ciclo em breve — risco de acumular 2 períodos vencidos (CLT)");
        }
        return sb.toString();
    }

    // ------------------------------------------------------------------
    // Utilitarios
    // ------------------------------------------------------------------
    private String fmtData(Timestamp t) {
        return t == null ? "-" : new SimpleDateFormat("dd/MM/yyyy").format(t);
    }

    private boolean isVazio(String s) {
        return s == null || s.trim().length() == 0;
    }

    private String safe(String s) {
        return s == null ? "-" : s;
    }

    /** Escapa para CSV: duplica aspas e delimita quando ha ';' ou '"'. */
    private String csv(String s) {
        if (s == null) {
            return "";
        }
        String v = s.replace("\"", "\"\"");
        return (v.indexOf(';') >= 0 || v.indexOf('"') >= 0) ? "\"" + v + "\"" : v;
    }

    private void fechar(AutoCloseable c) {
        if (c != null) {
            try {
                c.close();
            } catch (Exception ignore) {
                // fechamento best-effort: nao pode mascarar o erro original
            }
        }
    }

    private void log(String msg) {
        System.out.println("[AlertaFerias] " + msg);
    }

    /** Uma linha do resultado da consulta de elegibilidade. */
    private static class FuncionarioAlerta {
        int codEmp;
        int codFunc;
        /** Periodo de ferias (TFPFER.SEQUENCIA) - chave da deduplicacao do sino. */
        int sequencia;
        String nomeFunc;
        String descrDep;
        String razaoSocial;
        String lider;
        String emailLider;
        /** FER.DTLIMGOZFER; nulo quando o sistema ainda nao definiu o limite. */
        Timestamp limGozo;
        long diasParaVencer;
        /** limGozo com fallback para ADD_MONTHS(DTFINAQUI, 12). */
        Timestamp dataLimite;
        long diasAVencer;
        int periodosAbertos;
        boolean riscoAcumulo;
        boolean temRequisicaoPendente;
    }
}
