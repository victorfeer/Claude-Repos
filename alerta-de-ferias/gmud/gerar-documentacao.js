const {
  Document, Packer, Paragraph, Header, Footer, ImageRun, TextRun,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  AlignmentType, PageBreak, PageNumber
} = require("docx");
const fs = require("fs");

const NAVY = "1B3D6D", PINK = "D9709F", GRAY = "595959";
const CODEBG = "F2F2F2", CODEBORDER = "D6CFB6";
const AMBER = "8A6D1F", RED = "9C2B2B", GREEN = "1E6B3A";

const letterhead = fs.readFileSync("/root/.claude/skills/synced/voke-brand/assets/papel_timbrado_voke.png");

/* ---------------- helpers ---------------- */
function h1(text) {
  return new Paragraph({
    spacing: { before: 200, after: 140 },
    border: { bottom: { color: PINK, space: 4, style: BorderStyle.SINGLE, size: 12 } },
    children: [new TextRun({ text, bold: true, color: NAVY, size: 30, font: "Arial" })]
  });
}
function h2(text) {
  return new Paragraph({
    spacing: { before: 220, after: 90 },
    children: [new TextRun({ text, bold: true, color: NAVY, size: 24, font: "Arial" })]
  });
}
function h3(text) {
  return new Paragraph({
    spacing: { before: 170, after: 70 },
    children: [new TextRun({ text, bold: true, color: "2F5286", size: 21, font: "Arial" })]
  });
}
function p(runs, opts = {}) {
  const arr = Array.isArray(runs) ? runs : [runs];
  return new Paragraph({
    spacing: { after: 120, line: 276 },
    alignment: opts.align,
    children: arr.map(r => (typeof r === "string" ? new TextRun({ text: r, size: 22, font: "Arial" }) : r))
  });
}
function bullet(runs, lvl) {
  const arr = Array.isArray(runs) ? runs : [runs];
  return new Paragraph({
    bullet: { level: lvl || 0 },
    spacing: { after: 60, line: 268 },
    children: arr.map(r => (typeof r === "string" ? new TextRun({ text: r, size: 22, font: "Arial" }) : r))
  });
}
function num(runs) {
  const arr = Array.isArray(runs) ? runs : [runs];
  return new Paragraph({
    numbering: { reference: "passos", level: 0 },
    spacing: { after: 70, line: 268 },
    children: arr.map(r => (typeof r === "string" ? new TextRun({ text: r, size: 22, font: "Arial" }) : r))
  });
}
const strong = t => new TextRun({ text: t, bold: true, size: 22, font: "Arial" });
const mono   = t => new TextRun({ text: t, font: "Consolas", size: 18, color: "C0392B" });
const ital   = t => new TextRun({ text: t, italics: true, size: 22, font: "Arial", color: GRAY });

function codeBlock(lines) {
  return lines.map((ln, i) => new Paragraph({
    spacing: { after: 0, before: 0, line: 240 },
    shading: { type: ShadingType.CLEAR, color: "auto", fill: CODEBG },
    border: {
      left:  { style: BorderStyle.SINGLE, size: 18, color: CODEBORDER, space: 6 },
      right: { style: BorderStyle.SINGLE, size: 4, color: CODEBG, space: 6 },
      top:    i === 0 ? { style: BorderStyle.SINGLE, size: 4, color: CODEBG, space: 3 } : undefined,
      bottom: i === lines.length - 1 ? { style: BorderStyle.SINGLE, size: 4, color: CODEBG, space: 3 } : undefined
    },
    children: [new TextRun({ text: ln || " ", font: "Consolas", size: 15, color: "333333" })]
  }));
}
function callout(titulo, texto, cor) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: "E0DACA" },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: "E0DACA" },
      left: { style: BorderStyle.SINGLE, size: 18, color: cor || AMBER },
      right: { style: BorderStyle.SINGLE, size: 2, color: "E0DACA" },
      insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE }
    },
    rows: [new TableRow({ children: [new TableCell({
      shading: { type: ShadingType.CLEAR, color: "auto", fill: "FBF9F3" },
      margins: { top: 110, bottom: 110, left: 160, right: 140 },
      children: [
        new Paragraph({ spacing: { after: 50 }, children: [new TextRun({ text: titulo, bold: true, color: cor || AMBER, size: 20, font: "Arial" })] }),
        new Paragraph({ children: [new TextRun({ text: texto, size: 20, font: "Arial" })] })
      ]
    })]})]
  });
}
function kvTable(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "E5E0D0" },
      insideVertical: { style: BorderStyle.NONE }
    },
    rows: rows.map(([k, v]) => new TableRow({ children: [
      new TableCell({
        width: { size: 30, type: WidthType.PERCENTAGE },
        margins: { top: 60, bottom: 60, left: 40, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: k, bold: true, color: NAVY, size: 20, font: "Arial" })] })]
      }),
      new TableCell({
        width: { size: 70, type: WidthType.PERCENTAGE },
        margins: { top: 60, bottom: 60, left: 40, right: 40 },
        children: [new Paragraph({ children: [new TextRun({ text: v, size: 20, font: "Arial" })] })]
      })
    ]}))
  });
}
function dataTable(header, rows, widths) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: header.map((htxt, i) => new TableCell({
      width: { size: widths[i], type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, color: "auto", fill: NAVY },
      margins: { top: 60, bottom: 60, left: 80, right: 80 },
      children: [new Paragraph({ children: [new TextRun({ text: htxt, bold: true, color: "FFFFFF", size: 18, font: "Arial" })] })]
    }))
  });
  const bodyRows = rows.map((r, ri) => new TableRow({
    children: r.map((c, i) => new TableCell({
      width: { size: widths[i], type: WidthType.PERCENTAGE },
      shading: ri % 2 ? { type: ShadingType.CLEAR, color: "auto", fill: "F5F3EC" } : undefined,
      margins: { top: 50, bottom: 50, left: 80, right: 80 },
      children: [new Paragraph({ children: [new TextRun({ text: c, size: 18, font: "Arial" })] })]
    }))
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: "D6CFB6" },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: "D6CFB6" },
      left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "E5E0D0" },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: "E5E0D0" }
    },
    rows: [headerRow, ...bodyRows]
  });
}
const spacer = (n) => new Paragraph({ spacing: { after: n || 120 }, children: [] });

const children = [];

/* ================= CAPA ================= */
children.push(new Paragraph({ spacing: { after: 20 },
  children: [new TextRun({ text: "DOCUMENTAÇÃO TÉCNICA E FUNCIONAL", bold: true, color: NAVY, size: 36, font: "Arial" })] }));
children.push(new Paragraph({ spacing: { after: 170 },
  border: { bottom: { color: NAVY, space: 6, style: BorderStyle.SINGLE, size: 8 } },
  children: [new TextRun({ text: "Alerta de Férias a Vencer — ERP Sankhya Om", color: PINK, size: 26, font: "Arial", bold: true })] }));

children.push(kvTable([
  ["Desenvolvimento", "Alerta de Férias a Vencer"],
  ["Sistema", "ERP Sankhya Om"],
  ["Módulo funcional", "Recursos Humanos / Departamento Pessoal (Folha)"],
  ["Pacote Java", "br.com.voke.rh.ferias"],
  ["Ambiente de homologação", "erp-hml"],
  ["Finalidade do documento", "Passagem de conhecimento e anexo de GMUD"],
  ["Classificação", "Documento técnico interno — Voke"]
]));

children.push(spacer(200));
children.push(h2("Base documental e limites deste documento"));
children.push(p([
  "Este documento foi produzido a partir do material do próprio projeto. Para preservar a confiabilidade técnica, cada objeto está marcado com sua ",
  strong("procedência"), ". Nada foi inferido além do que o material sustenta."
]));
children.push(dataTable(
  ["Marcação", "Significado"],
  [
    ["CONFIRMADO", "Validado no ambiente real ou decisão fechada com o key user."],
    ["RECONSTITUÍDO", "Reconstruído a partir do histórico do projeto; exige conferência contra o código-fonte definitivo."],
    ["PENDENTE", "Bloqueio real, ainda não resolvido. Impede ou condiciona a entrada em produção."],
    ["NÃO FORNECIDO", "Artefato citado na documentação, porém não disponibilizado para esta análise."]
  ], [22, 78]
));

children.push(spacer(140));
children.push(callout("Artefatos citados que NÃO foram fornecidos para esta análise",
  "Os arquivos a seguir são referenciados pelo README.md/CLAUDE.md do repositório, mas não foram anexados: docs/fluxo-decidido.md; docs/pendencias.md; os arquivos-fonte .sql originais (sql/vw_alerta_ferias_a_vencer.sql e sql/stp_notifica_sistema_custom.sql); o arquivo-fonte AlertaFeriasNotificacao.java; e as atas, requisitos e evidências mencionados na solicitação. O conteúdo de SQL e Java aqui documentado provém da documentação consolidada do projeto, não da leitura dos arquivos-fonte definitivos.",
  RED));

children.push(spacer(140));
children.push(callout("Divergência de versão entre os anexos e o estado real da solução",
  "O README.md e o CLAUDE.md anexados descrevem um estágio ANTERIOR do projeto: declaram três pendências bloqueando produção e a solução como \"em desenvolvimento\". A documentação consolidada do projeto registra estágio posterior, com homologação concluída no ambiente erp-hml. Em particular, a pendência nº 2 (mecanismo de envio de e-mail) foi RESOLVIDA por meio da fila nativa TMDFMG. Este documento descreve o estado posterior e sinaliza, na seção 15, quais pendências permanecem efetivamente abertas.",
  AMBER));

children.push(new Paragraph({ children: [new PageBreak()] }));

/* ================= 1. OBJETIVO ================= */
children.push(h1("1. Objetivo da melhoria"));
children.push(p([
  "Evitar que colaboradores acumulem um ", strong("segundo período de férias"),
  ", situação que gera ", strong("pagamento em dobro"),
  " por força da CLT, por meio de avisos antecipados e automáticos ao Departamento Pessoal, ao líder da equipe e ao próprio sistema."
]));
children.push(p("A solução substitui o acompanhamento manual por uma rotina diária automatizada que identifica, notifica e mantém o alerta ativo até que o período de férias seja efetivamente definido."));

children.push(h2("Objetivos específicos"));
children.push(bullet(["Identificar, com antecedência configurada de ", mono("90 dias"), ", quem está próximo do limite de gozo."]));
children.push(bullet("Notificar o DP por três canais complementares: pop-up, sininho e e-mail."));
children.push(bullet(["Notificar cada líder ", strong("apenas sobre a sua própria equipe"), "."]));
children.push(bullet("Oferecer ao DP um painel de consulta com filtros, indicadores e exportação."));
children.push(bullet("Encerrar o alerta automaticamente quando o período for definido, sem intervenção manual."));

/* ================= 2. CONTEXTO ================= */
children.push(h1("2. Contexto de negócio"));
children.push(p([
  "A CLT estabelece um ", strong("período concessivo"),
  " para o gozo das férias após o encerramento do período aquisitivo. Não concedidas dentro desse prazo, as férias passam a ser devidas ",
  strong("em dobro"), ", com impacto financeiro direto e passivo trabalhista."
]));
children.push(p("Antes desta melhoria, o acompanhamento dependia de conferência manual do DP sobre a base de períodos aquisitivos. O risco não estava na ausência do dado — que já existe no ERP — mas na ausência de um mecanismo ativo que trouxesse o dado à atenção do responsável no momento certo."));

children.push(h2("Premissa central adotada"));
children.push(p([
  "A rotina roda diariamente e a ", strong("própria consulta funciona como detector de pendência"),
  ": o colaborador permanece na lista enquanto não houver férias definidas para ele e ",
  strong("sai automaticamente"), " quando o período é definido. ", strong("Não existe supressão manual"),
  " — decisão deliberada, para que nenhum caso seja silenciado sem tratamento efetivo."
]));

/* ================= 3. FLUXO ================= */
children.push(h1("3. Fluxo da solução implementada"));
children.push(p("Esteira de execução, na ordem em que ocorre a cada disparo diário:"));
children.push(num([strong("Detecção"), " — seleção dos colaboradores na janela de alerta, conforme os critérios A e B (seção 10)."]));
children.push(num([strong("Pop-up"), " — aviso imediato ao DP, com importância ", mono("0 (Urgentíssimo)"), "."]));
children.push(num([strong("Sininho"), " — aviso persistente, com navegação para o painel."]));
children.push(num([strong("Painel HTML5"), " — consulta completa, filtros e indicadores."]));
children.push(num([strong("Drill-through"), " — atalho para a tela de Requisição de Férias."]));
children.push(num([strong("E-mail ao líder"), " — cada líder recebe somente a sua equipe."]));
children.push(num([strong("E-mail ao DP"), " — consolidado geral, reenviado diariamente até a resolução."]));

children.push(spacer(120));
children.push(h2("Comportamento por canal"));
children.push(dataTable(
  ["Canal", "Deduplicação", "Comportamento"],
  [
    ["Pop-up", "Não", "Disparado a cada execução com resultado."],
    ["Sininho", "Sim — AD_FERIAS_NOTIFICADO", "Um aviso por colaborador. Modo DIFF notifica somente quem é novo na janela."],
    ["E-mail (DP)", "Não", "Reenviado diariamente a todos que ainda constam na consulta."],
    ["E-mail (líder)", "Não", "Um e-mail por líder, contendo apenas a sua equipe."],
    ["Painel HTML5", "N/A", "Consulta sob demanda pelo usuário."]
  ], [18, 30, 52]
));
children.push(spacer(100));
children.push(callout("Decisão de projeto — por que o e-mail não usa supressão",
  "O sininho utiliza AD_FERIAS_NOTIFICADO para não repetir o mesmo aviso todos os dias. O e-mail, deliberadamente, NÃO usa supressão: ele é reenviado enquanto o colaborador permanecer na consulta. O encerramento do envio é consequência da resolução do caso (o colaborador sai da view), e não de uma marcação de \"já avisado\".",
  NAVY));

node_check_marker = 1;

/* ================= 4. ARQUITETURA ================= */
children.push(h1("4. Arquitetura da solução"));
children.push(p("A solução é composta por sete peças que compartilham a mesma regra de negócio, distribuídas entre banco de dados, camada Java agendada e interface HTML5."));
children.push(dataTable(
  ["Componente", "Tipo", "Papel", "Consumido por"],
  [
    ["VW_ALERTA_FERIAS_A_VENCER", "View (Oracle)", "Fonte da lista principal do painel", "Tela HTML5"],
    ["STP_NOTIFICA_SISTEMA_CUSTOM", "Procedure PL/SQL", "Grava aviso na TSIAVI (pop-up/sino)", "Job Java"],
    ["AD_FERIAS_NOTIFICADO", "Tabela", "Deduplicação do sino (modo DIFF)", "Job Java"],
    ["AD_FERIAS_CONFIG", "Tabela chave/valor", "Parâmetros de e-mail sem recompilar", "Job Java"],
    ["TMDFMG", "Tabela nativa (fila)", "Fila de e-mail; despachante nativo envia", "Job Java"],
    ["AlertaFeriasNotificacao", "Ação Agendada Java", "Orquestra consulta, dedup, notificação e e-mails", "Agendador (CRON)"],
    ["Painel Alerta de Férias", "Tela HTML5", "Consulta, filtros, KPIs, CSV, drill-through", "Usuário DP"]
  ], [26, 16, 36, 22]
));

children.push(spacer(140));
children.push(h2("4.1. Os dois caminhos de dados"));
children.push(p([
  "A arquitetura possui ", strong("dois caminhos independentes que aplicam a mesma regra de negócio"), ":"
]));
children.push(bullet([strong("Caminho do PAINEL"), " — Tela HTML5 → serviço ", mono("DbExplorerSP.executeQuery"), " → view ", mono("VW_ALERTA_FERIAS_A_VENCER"), "."]));
children.push(bullet([strong("Caminho do JOB"), " — Ação Agendada ", mono("AlertaFeriasNotificacao"), " → consulta consolidada própria → fila ", mono("TMDFMG"), " e procedure de notificação."]));
children.push(spacer(80));
children.push(callout("Risco arquitetural central do projeto",
  "A regra de elegibilidade está implementada em DOIS lugares (a view, usada pelo painel; e a consulta do job Java). Toda evolução de regra precisa ser aplicada nos dois pontos, sob pena de o painel e o e-mail divergirem. Em especial, a definição de data de vencimento deve ser alinhada: a view expõe LIMGOZO e o job utiliza o critério equivalente DTLIMGOZFER.",
  RED));

children.push(spacer(140));
children.push(h2("4.2. Fluxo técnico do disparo diário"));
children.push(codeBlock([
  "  [Agendador CRON do Sankhya]",
  "            |",
  "            v",
  "  AlertaFeriasNotificacao.executarRotina()",
  "            |",
  "            +--> consultarConsolidado()  ---> TFPFER / TFPFUN / TFPDEP / TFPCAR / TSIEMP",
  "            |                                 (+ TFPREQ / TFPREQADM para requisicoes)",
  "            |",
  "            +--> [vazio?] --> encerra sem notificar (ENVIAR_QUANDO_VAZIO = N)",
  "            |",
  "            +--> montarHtmlConsolidado() --> enviarEmail(DP)      --> INSERT TMDFMG",
  "            |",
  "            +--> agruparPorLider()       --> enviarEmail(lider)   --> INSERT TMDFMG",
  "            |         (chave = AD_EMAILLIDER)",
  "            |",
  "            +--> chamarNotificacao(popup) --> STP_NOTIFICA_SISTEMA_CUSTOM --> TSIAVI",
  "            |",
  "            +--> filtrarEnviarSino()      --> STP_NOTIFICA_SISTEMA_CUSTOM --> TSIAVI",
  "                      |                         (somente ENVIAR_SINO = 'S')",
  "                      +--> registrarComoNotificados() --> AD_FERIAS_NOTIFICADO",
  "",
  "  [Despachante nativo do Sankhya] --> le TMDFMG STATUS='Pendente' --> envia SMTP",
  "                                      --> atualiza STATUS='Sucesso: Enviada'"
]));

/* ================= 5. JAVA ================= */
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(h1("5. Documentação da classe Java"));
children.push(callout("Procedência desta seção",
  "RECONSTITUÍDO. O arquivo-fonte AlertaFeriasNotificacao.java não foi fornecido para esta análise. O cabeçalho, as regras aplicadas e as decisões de projeto são fiéis à documentação consolidada; as implementações internas de consulta, montagem de HTML e obtenção de conexão devem ser conferidas contra o código definitivo antes de qualquer alteração.",
  AMBER));

children.push(spacer(140));
children.push(h2("5.1. Identificação"));
children.push(kvTable([
  ["Classe", "AlertaFeriasNotificacao"],
  ["Pacote", "br.com.voke.rh.ferias"],
  ["Tipo", "Ação Agendada (Cuckoo) do Sankhya"],
  ["Gatilho", "CRON diário (cadastro único)"],
  ["Encoding de compilação", "UTF-8 (obrigatório, para preservar acentuação)"]
]));

children.push(h2("5.2. Responsabilidade da classe"));
children.push(p("Orquestrar, em uma única execução diária, a detecção dos colaboradores com férias a vencer e o disparo coordenado dos três canais de notificação: e-mail consolidado ao DP, e-mail individual por líder e pop-up/sininho."));
children.push(p([strong("A classe não implementa a regra de vencimento em duplicidade com a view por acaso"),
  " — ela mantém a sua própria consulta consolidada porque roda fora do contexto da tela. Ver risco arquitetural na seção 4.1."]));

children.push(h2("5.3. Constantes de configuração"));
children.push(dataTable(
  ["Constante", "Valor documentado", "Função"],
  [
    ["MODO_TESTE", "false (produção)", "Redireciona todos os e-mails para EMAIL_TESTE quando true."],
    ["EMAIL_TESTE", "victor.ferreira@voke.tech", "Destino único durante o modo teste."],
    ["EMAIL_DESTINATARIOS_DP", "karina.souza@voke.tech; departamentopessoal@voke.tech; victor.ferreira@voke.tech", "Destinatários do consolidado."],
    ["ENVIAR_POR_LIDER", "true", "Liga/desliga o e-mail individual por líder."],
    ["ANEXAR_CSV", "false", "Anexa o CSV consolidado no e-mail do DP."],
    ["CODGRUPO_DP", "123 — PENDENTE", "Grupo de key users do DP. Valor placeholder."],
    ["CODUSU_REMETENTE_SISTEMA", "-1", "Remetente do aviso de sino (\"Sistema\")."],
    ["JANELA_DIAS_ALERTA", "90", "Antecedência da janela de alerta."],
    ["STATUS_A_ENVIAR", "\"Pendente\"", "Status inicial na fila TMDFMG."],
    ["CODCON_EMAIL", "0", "Conta de e-mail. Valores 0/168/143 observados; 0 nos envios recentes."],
    ["CODSMTP_EMAIL", "11", "Servidor SMTP do DP."]
  ], [24, 34, 42]
));

children.push(spacer(120));
children.push(callout("Recomendação técnica",
  "As constantes de e-mail permanecem parcialmente hardcoded na classe. A recomendação registrada no projeto é migrar todas para a tabela AD_FERIAS_CONFIG, de modo que alterações de destinatário ou de modo de teste não exijam recompilação e novo deploy do .jar.",
  NAVY));

children.push(h2("5.4. Métodos"));
children.push(dataTable(
  ["Método", "Responsabilidade", "Procedência"],
  [
    ["executarRotina()", "Ponto de entrada da Ação Agendada. Orquestra toda a esteira.", "PENDENTE — assinatura real depende da interface do Cuckoo.jar"],
    ["consultarConsolidado()", "Lê a base consolidada (mesma regra da tela) e retorna a lista de alertas.", "RECONSTITUÍDO"],
    ["montarHtmlConsolidado(alertas)", "Monta o corpo HTML do e-mail do DP, agrupado por faixa de urgência.", "RECONSTITUÍDO"],
    ["montarHtmlEquipe(alertas)", "Monta o corpo HTML do e-mail de um líder, com apenas a sua equipe.", "RECONSTITUÍDO"],
    ["montarHtmlLideresSemEmail(lista)", "Monta o aviso ao DP listando líderes sem e-mail cadastrado.", "RECONSTITUÍDO"],
    ["agruparPorLider(alertas)", "Agrupa os alertas pela chave AD_EMAILLIDER (e-mail, não nome).", "CONFIRMADO (decisão de projeto)"],
    ["enviarEmail(dest, assunto, corpo, csv)", "Ponto ÚNICO de saída de e-mail. Aplica modo teste e enfileira na TMDFMG.", "CONFIRMADO (mecanismo TMDFMG)"],
    ["chamarNotificacao(popup, qtd)", "Chama STP_NOTIFICA_SISTEMA_CUSTOM para pop-up ou sino.", "RECONSTITUÍDO — helper Java→PL/SQL depende do ambiente"],
    ["filtrarEnviarSino(alertas)", "Filtra apenas os registros com ENVIAR_SINO = 'S'.", "CONFIRMADO (regra de negócio)"],
    ["registrarComoNotificados(lista)", "Grava em AD_FERIAS_NOTIFICADO para o modo DIFF.", "RECONSTITUÍDO"],
    ["gerarCsv(alertas)", "Gera o CSV consolidado, quando ANEXAR_CSV = true.", "RECONSTITUÍDO"],
    ["obterConexao()", "Obtém conexão via datasource JNDI.", "PENDENTE — nome JNDI não confirmado"]
  ], [27, 43, 30]
));

children.push(h2("5.5. Fluxo de execução"));
children.push(num(["Lê o consolidado por ", mono("consultarConsolidado()"), "."]));
children.push(num(["Se a lista estiver vazia, encerra sem notificar (salvo ", mono("ENVIAR_QUANDO_VAZIO = 'S'"), ")."]));
children.push(num(["Monta e envia o ", strong("e-mail consolidado ao DP"), " (melhoria 03)."]));
children.push(num(["Se ", mono("ENVIAR_POR_LIDER"), ", agrupa por ", mono("AD_EMAILLIDER"), " e envia um e-mail por líder (melhoria 04). Líderes sem e-mail geram um aviso ao DP."]));
children.push(num(["Dispara o ", strong("pop-up"), " ao DP."]));
children.push(num(["Filtra ", mono("ENVIAR_SINO = 'S'"), ", dispara o ", strong("sininho"), " e registra em ", mono("AD_FERIAS_NOTIFICADO"), "."]));

children.push(h2("5.6. Modos de execução"));
children.push(dataTable(
  ["Modo", "Quando", "Comportamento"],
  [
    ["DIFF", "Dias normais", "Notifica no sino apenas quem é novo na janela (consulta AD_FERIAS_NOTIFICADO)."],
    ["COMPLETO", "Último dia útil do mês", "Varredura de reforço, sem filtro de já-notificados. Não marca como notificado."]
  ], [16, 26, 58]
));

children.push(h2("5.7. Tratamento de erros"));
children.push(bullet([strong("Isolamento do e-mail:"), " o envio é protegido por ", mono("try/catch"),
  " — uma falha no e-mail ", strong("não interrompe"), " a notificação de sino/pop-up."]));
children.push(bullet(["Erros da rotina sobem com a ", strong("cadeia de causas concatenada"),
  " na mensagem, porque a tela de Ações Agendadas exibe apenas o topo da exceção."]));
children.push(bullet(["O log ", mono("WARN ScheduledActionsSP.isActiveJob"), " é da ",
  strong("plataforma"), ", não da customização, e não impede a execução."]));

children.push(h2("5.8. Dependências"));
children.push(dataTable(
  ["Dependência", "Natureza", "Observação"],
  [
    ["Cuckoo.jar", "Plataforma Sankhya", "Interface de Ação Agendada. Assinatura real PENDENTE."],
    ["Datasource JNDI", "Infraestrutura", "Nome do recurso PENDENTE."],
    ["java.sql / javax.sql", "JDK", "Connection, PreparedStatement, CallableStatement, ResultSet."],
    ["javax.naming", "JDK", "InitialContext para lookup do datasource."],
    ["STP_NOTIFICA_SISTEMA_CUSTOM", "Objeto de banco", "Procedure customizada, entregue por esta GMUD."],
    ["TMDFMG", "Tabela nativa", "Fila de e-mail. Despachante nativo faz o envio."],
    ["AD_FERIAS_CONFIG / AD_FERIAS_NOTIFICADO", "Objetos de banco", "Tabelas customizadas, entregues por esta GMUD."]
  ], [30, 22, 48]
));

/* ================= 6. PROCEDURES ================= */
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(h1("6. Documentação das procedures"));
children.push(p("Foi identificada uma única procedure customizada neste desenvolvimento."));

children.push(h2("6.1. STP_NOTIFICA_SISTEMA_CUSTOM"));
children.push(kvTable([
  ["Tipo", "PROCEDURE (PL/SQL)"],
  ["Origem", "Cópia customizada da procedure nativa STP_NOTIFICA_SISTEMA"],
  ["Procedência", "CONFIRMADO"]
]));
children.push(h3("Objetivo"));
children.push(p([
  "Gravar notificação na central de avisos (", mono("TSIAVI"), ") — pop-up e sininho — para o grupo do DP. ",
  "A motivação da cópia é expor o parâmetro ", mono("P_IMPORTANCIA"),
  ", fixo em ", mono("3"), " na procedure nativa, permitindo enviar o alerta como ", mono("0 (Urgentíssimo)"), "."
]));
children.push(h3("Parâmetros"));
children.push(dataTable(
  ["Parâmetro", "Tipo", "Descrição"],
  [
    ["P_TITULO", "VARCHAR2", "Título do aviso."],
    ["P_DESCRICAO", "VARCHAR2", "Corpo do aviso."],
    ["P_CODUSU", "NUMBER", "Usuário destinatário. Se preenchido, o grupo é ignorado (CODGRUPO := NULL)."],
    ["P_CODGRUPO", "NUMBER", "Grupo destinatário. Usado somente quando P_CODUSU é NULL."],
    ["P_CODUSUREMETENTE", "NUMBER", "Usuário remetente. -1 corresponde a \"Sistema\"."],
    ["P_IMPORTANCIA", "NUMBER (DEFAULT 3)", "Importância do aviso. 0 = Urgentíssimo. O DEFAULT preserva compatibilidade."]
  ], [26, 20, 54]
));
children.push(h3("Tabelas utilizadas"));
children.push(bullet([mono("TSIAVI"), " — INSERT (central de notificações). Leitura de ", mono("MAX(NUAVISO)"), " para gerar a chave."]));
children.push(h3("Regras de negócio"));
children.push(bullet(["Destinatário é ", strong("exclusivo"), ": usuário ", strong("ou"), " grupo. Havendo ", mono("P_CODUSU"), ", o grupo é anulado."]));
children.push(bullet([mono("IDENTIFICADOR"), " fixo em ", mono("'API'"), " e ", mono("TIPO"), " fixo em ", mono("'P'"), "."]));
children.push(bullet([mono("DHCRIACAO"), " recebe ", mono("SYSDATE"), "."]));
children.push(h3("Código-fonte"));
children.push(...codeBlock([
  "CREATE OR REPLACE PROCEDURE STP_NOTIFICA_SISTEMA_CUSTOM(",
  "                P_TITULO             VARCHAR2,",
  "                P_DESCRICAO          VARCHAR2,",
  "                P_CODUSU             NUMBER,",
  "                P_CODGRUPO           NUMBER,",
  "                P_CODUSUREMETENTE    NUMBER,",
  "                P_IMPORTANCIA        NUMBER DEFAULT 3)",
  "AS",
  "BEGIN",
  "  DECLARE",
  "    V_CODGRUPO NUMBER;",
  "    V_NUAVISO  NUMBER;",
  "  BEGIN",
  "    IF (P_CODUSU IS NOT NULL) THEN",
  "      V_CODGRUPO := NULL;",
  "    ELSE",
  "      V_CODGRUPO := P_CODGRUPO;",
  "    END IF;",
  "    SELECT NVL(MAX(NUAVISO), 0)+1 INTO V_NUAVISO FROM TSIAVI;",
  "    INSERT INTO TSIAVI",
  "                (NUAVISO, TITULO, DESCRICAO, IDENTIFICADOR, IMPORTANCIA,",
  "                 CODUSU, CODGRUPO, TIPO, DHCRIACAO, CODUSUREMENTI)",
  "    VALUES      (V_NUAVISO, P_TITULO, P_DESCRICAO, 'API', P_IMPORTANCIA,",
  "                 P_CODUSU, V_CODGRUPO, 'P', SYSDATE, P_CODUSUREMETENTE);",
  "  END;",
  "END;"
]));
children.push(spacer(120));
children.push(h3("Chamada de referência"));
children.push(...codeBlock([
  "BEGIN",
  "  STP_NOTIFICA_SISTEMA_CUSTOM(",
  "    P_TITULO          => 'Alerta de Férias a Vencer',",
  "    P_DESCRICAO       => 'Existem colaboradores com férias a vencer dentro do',",
  "    P_CODUSU          => NULL,",
  "    P_CODGRUPO        => 123,   -- << SUBSTITUIR pelo CODGRUPO real do DP",
  "    P_CODUSUREMETENTE => -1,    -- -1 = Sistema",
  "    P_IMPORTANCIA     => 0      -- Urgentíssimo",
  "  );",
  "END;"
]));
children.push(spacer(120));
children.push(h3("Impactos e riscos"));
children.push(callout("Riscos mantidos deliberadamente nesta versão",
  "1) NUAVISO é gerado por MAX(NUAVISO)+1, o que apresenta risco de race condition em chamadas concorrentes. 2) A procedure não possui bloco EXCEPTION. Ambos os pontos foram herdados da procedure nativa e mantidos de propósito — apenas os parâmetros foram ajustados —, de modo a não introduzir divergência de comportamento em relação ao objeto original do produto.",
  AMBER));
children.push(spacer(100));
children.push(callout("Pendência — CODGRUPO do DP",
  "O valor 123 é placeholder. Antes da entrada em produção, confirmar o código real do grupo por meio de: SELECT CODGRUPO, DESCRGRU FROM TSIGRU WHERE DESCRGRU LIKE '%DP%'. Um CODGRUPO incorreto faz o aviso ser gravado, porém entregue ao grupo errado — falha silenciosa.",
  RED));

/* ================= 7. VIEWS ================= */
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(h1("7. Documentação das views"));
children.push(p("Foi identificada uma única view customizada neste desenvolvimento."));

children.push(h2("7.1. VW_ALERTA_FERIAS_A_VENCER"));
children.push(kvTable([
  ["Tipo", "VIEW (Oracle)"],
  ["Origem funcional", "Relatório Jasper \"Alerta de Férias a Vencer (V20)\""],
  ["Consumidor", "Tela HTML5, via serviço DbExplorerSP.executeQuery"],
  ["Procedência", "CONFIRMADO — validada com key user"]
]));
children.push(h3("Objetivo"));
children.push(p([
  "Listar os funcionários cujo limite de gozo de férias se aproxima do vencimento, dentro da janela de 90 dias, para ação preventiva do RH antes de gerar dobra trabalhista. É a ",
  strong("única fonte da verdade sobre quem deve ser avisado"), " no caminho do painel."
]));

children.push(h3("Tabelas de origem"));
children.push(dataTable(
  ["Tabela", "Junção", "Papel"],
  [
    ["TFPFER", "Tabela base (FER)", "Períodos de férias."],
    ["TFPFUN", "INNER JOIN por CODEMP + CODFUNC", "Cadastro do funcionário, incluindo AD_LIDER e AD_EMAILLIDER."],
    ["TSIEMP", "INNER JOIN por CODEMP", "Empresa (RAZAOSOCIAL)."],
    ["TFPDEP", "LEFT JOIN por CODDEP", "Departamento."],
    ["TFPCAR", "LEFT JOIN por CODCARGO", "Cargo."],
    ["TFPREQ + TFPREQADM", "EXISTS / NOT EXISTS por CODFUNC", "Requisições de férias (pendente e aprovada)."]
  ], [20, 34, 46]
));

children.push(h3("Campos retornados"));
children.push(dataTable(
  ["Campo", "Origem / Cálculo", "Finalidade"],
  [
    ["CODEMP", "FUN.CODEMP", "Empresa do funcionário."],
    ["RAZAOSOCIAL", "EMP.RAZAOSOCIAL", "Nome da empresa."],
    ["CODFUNC", "FUN.CODFUNC", "Código do funcionário."],
    ["NOMEFUNC", "FUN.NOMEFUNC", "Nome do funcionário."],
    ["CODDEP / DESCRDEP", "FUN.CODDEP / DEP.DESCRDEP", "Departamento."],
    ["CODCARGO / DESCRCARGO", "FUN.CODCARGO / CAR.DESCRCARGO", "Cargo."],
    ["AD_LIDER", "FUN.AD_LIDER", "Nome do líder (campo customizado)."],
    ["AD_EMAILLIDER", "FUN.AD_EMAILLIDER", "E-mail do líder. Chave de agrupamento do e-mail por líder."],
    ["DTINIAQUI / DTFINAQUI", "FER.DTINIAQUI / FER.DTFINAQUI", "Início e fim do período aquisitivo."],
    ["LIMGOZO", "FER.DTFINAQUI + 330", "Data-limite de gozo estimada."],
    ["DIAS_PARA_VENCER", "(DTFINAQUI + 330) - TRUNC(SYSDATE)", "Dias até o vencimento. Ordena e colore a urgência."],
    ["DTSAIDA", "FER.DTSAIDA", "Data de saída de férias."],
    ["NUMDIASFER", "FER.NUMDIASFER", "Quantidade de dias de férias."],
    ["RETORNO", "DTSAIDA + NUMDIASFER - 1", "Data de retorno prevista."],
    ["QTD_PERIODOS_NA_JANELA", "COUNT(*) OVER (PARTITION BY CODFUNC)", "Períodos simultâneos do mesmo funcionário."],
    ["ENVIAR_SINO", "CASE sobre TFPREQ (STATUS = 1)", "'N' se há requisição pendente; 'S' caso contrário."]
  ], [24, 34, 42]
));

children.push(h3("Regras aplicadas no WHERE"));
children.push(bullet([mono("EMP.CODEMP >= 20"), " — recorte de empresas."]));
children.push(bullet([mono("FUN.SITUACAO NOT IN (0, 2, 8, 9)"), " — exclui Demitido, Afastado sem remuneração, Transferido e Aposentado por invalidez."]));
children.push(bullet([mono("FUN.VINCULO NOT IN (80, 90)"), " — exclui vínculos não aplicáveis."]));
children.push(bullet([mono("FUN.DTDEM IS NULL"), " — exclui demitidos."]));
children.push(bullet(["Somente períodos não gozados ou quitados: ", mono("DTSAIDA IS NULL"), ", ",
  mono("DTPREVISTA IS NULL"), ", ", mono("NVL(ATUALFERGOZ,'N') <> 'S'"), ", ", mono("NUMDIASFER <> 0"), "."]));
children.push(bullet(["Janela de 90 dias: ", mono("(DTFINAQUI + 330) BETWEEN TRUNC(SYSDATE) AND TRUNC(SYSDATE) + 90"), "."]));
children.push(bullet([mono("NOT EXISTS"), " de requisição ", strong("aprovada"), " (", mono("STATUS = 2"), ") — o funcionário sai da view."]));

children.push(spacer(120));
children.push(callout("Decisão funcional — situações 4, 5 e 6 permanecem no alerta",
  "As situações 4 (serviço militar), 5 (licença maternidade) e 6 (doença superior a 15 dias) são MANTIDAS deliberadamente na view. O prazo legal do período concessivo corre independentemente da situação do colaborador, de modo que excluí-las criaria um ponto cego de passivo trabalhista.",
  NAVY));

children.push(spacer(100));
children.push(callout("Suposição técnica de maior impacto — o número 330",
  "DTFINAQUI é o fim do período aquisitivo e o valor +330 aproxima o fim do período concessivo (aproximadamente 12 meses da CLT). Este é o ponto de maior suposição do modelo. A coluna LIMGOZO calculada de forma mais precisa seria ADD_MONTHS(DTFINAQUI,12) - (NUMDIASFER+10) + 1. Recomenda-se confirmar com o RH se os 330 dias fixos correspondem à régua real adotada.",
  AMBER));

children.push(spacer(120));
children.push(h3("Código-fonte"));
children.push(...codeBlock([
  "CREATE OR REPLACE VIEW VW_ALERTA_FERIAS_A_VENCER AS",
  "SELECT",
  "    FUN.CODEMP, EMP.RAZAOSOCIAL, FUN.CODFUNC, FUN.NOMEFUNC,",
  "    FUN.CODDEP, DEP.DESCRDEP, FUN.CODCARGO, CAR.DESCRCARGO,",
  "    FUN.AD_LIDER, FUN.AD_EMAILLIDER,",
  "    FER.DTINIAQUI, FER.DTFINAQUI,",
  "    FER.DTFINAQUI + 330                            AS LIMGOZO,",
  "    (FER.DTFINAQUI + 330) - TRUNC(SYSDATE)         AS DIAS_PARA_VENCER,",
  "    FER.DTSAIDA, FER.NUMDIASFER,",
  "    FER.DTSAIDA + FER.NUMDIASFER - 1               AS RETORNO,",
  "    COUNT(*) OVER (PARTITION BY FUN.CODFUNC)       AS QTD_PERIODOS_NA_JANELA,",
  "    CASE",
  "        WHEN EXISTS (",
  "            SELECT 1 FROM TFPREQ REQ",
  "            INNER JOIN TFPREQADM ADM ON ADM.ID = REQ.ORIGEMID",
  "            WHERE REQ.ORIGEMTIPO = 'V'",
  "              AND REQ.STATUS     = 1      -- pendente (nao aprovada)",
  "              AND REQ.CODFUNC    = FUN.CODFUNC",
  "        ) THEN 'N' ELSE 'S'",
  "    END                                            AS ENVIAR_SINO",
  "FROM   TFPFER FER",
  "INNER JOIN TFPFUN FUN ON FUN.CODEMP = FER.CODEMP AND FUN.CODFUNC = FER.CODFUNC",
  "INNER JOIN TSIEMP EMP ON EMP.CODEMP = FUN.CODEMP",
  "LEFT  JOIN TFPDEP DEP ON DEP.CODDEP = FUN.CODDEP",
  "LEFT  JOIN TFPCAR CAR ON CAR.CODCARGO = FUN.CODCARGO",
  "WHERE  EMP.CODEMP  >= 20",
  "  AND  FUN.SITUACAO NOT IN (0, 2, 8, 9)",
  "  AND  FUN.VINCULO  NOT IN (80, 90)",
  "  AND  FUN.DTDEM IS NULL",
  "  AND  (FER.DTFINAQUI + 330) BETWEEN TRUNC(SYSDATE) AND TRUNC(SYSDATE) + 90",
  "  AND  FER.NUMDIASFER <> 0",
  "  AND  FER.DTSAIDA    IS NULL",
  "  AND  FER.DTPREVISTA IS NULL",
  "  AND  NVL(FER.ATUALFERGOZ, 'N') <> 'S'",
  "  AND  NOT EXISTS (",
  "        SELECT 1 FROM TFPREQ REQ",
  "        INNER JOIN TFPREQADM ADM ON ADM.ID = REQ.ORIGEMID",
  "        WHERE REQ.ORIGEMTIPO = 'V'",
  "          AND REQ.STATUS     = 2          -- ja aprovada: sai da view",
  "          AND REQ.CODFUNC    = FUN.CODFUNC",
  "    );"
]));

/* ================= 8. BANCO ================= */
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(h1("8. Banco de dados impactado"));

children.push(h2("8.1. Objetos criados por este desenvolvimento"));
children.push(dataTable(
  ["Objeto", "Tipo", "Operação", "Finalidade"],
  [
    ["VW_ALERTA_FERIAS_A_VENCER", "View", "CREATE OR REPLACE", "Fonte de elegibilidade do painel."],
    ["STP_NOTIFICA_SISTEMA_CUSTOM", "Procedure", "CREATE OR REPLACE", "Notificação em TSIAVI com importância parametrizável."],
    ["AD_FERIAS_CONFIG", "Tabela", "CREATE TABLE", "Parâmetros de e-mail (chave/valor)."],
    ["AD_FERIAS_NOTIFICADO", "Tabela", "CREATE TABLE", "Deduplicação do sino no modo DIFF."]
  ], [30, 14, 22, 34]
));

children.push(h2("8.2. AD_FERIAS_CONFIG"));
children.push(p([strong("Modelo chave/valor"), " — cada parâmetro é uma linha, permitindo ajustar destinatários e modo de teste ", strong("sem recompilar o .jar"), "."]));
children.push(...codeBlock([
  "CREATE TABLE AD_FERIAS_CONFIG (",
  "    PARAMETRO   VARCHAR2(50)  NOT NULL,",
  "    VALOR       VARCHAR2(400),",
  "    DESCRICAO   VARCHAR2(400),",
  "    CONSTRAINT PK_AD_FERIAS_CONFIG PRIMARY KEY (PARAMETRO)",
  ");"
]));
children.push(spacer(120));
children.push(dataTable(
  ["PARAMETRO", "Valor de produção", "Descrição"],
  [
    ["MODO_TESTE", "N", "S = redireciona TODOS os e-mails para EMAIL_TESTE. N = envio real."],
    ["EMAIL_TESTE", "victor.ferreira@voke.tech", "Destino único quando MODO_TESTE = S."],
    ["DESTINATARIOS_DP", "karina.souza@voke.tech; departamentopessoal@voke.tech; victor.ferreira@voke.tech", "E-mails do DP/RH para o consolidado (melhoria 03)."],
    ["ENVIAR_POR_LIDER", "S", "S = envia e-mail individual por líder (melhoria 04)."],
    ["ANEXAR_CSV", "N", "S = anexa o CSV consolidado no e-mail do DP."],
    ["ENVIAR_QUANDO_VAZIO", "N", "S = envia e-mail mesmo sem alertas (confirma execução)."]
  ], [22, 34, 44]
));

children.push(h2("8.3. AD_FERIAS_NOTIFICADO"));
children.push(p([
  "Controle de deduplicação do ", strong("sino"), " no modo ", strong("DIFF"),
  ". Estrutura documentada no projeto: uma linha por ", mono("CODEMP + CODFUNC + DTINIAQUI"),
  " (ou equivalente), com a data de notificação."
]));
children.push(callout("Atenção — DDL não fornecida",
  "A DDL completa de AD_FERIAS_NOTIFICADO não consta no material analisado; apenas a sua chave lógica e finalidade. A documentação do projeto indica que a sugestão de DDL está ao final do arquivo AlertaFeriasNotificacao.java, que não foi fornecido. Obter a DDL definitiva antes da implantação.",
  RED));
children.push(spacer(100));
children.push(callout("Regra operacional obrigatória",
  "Não ativar a Ação Agendada em modo DIFF em produção antes de criar esta tabela. Sem ela, o mesmo alerta de sino é duplicado todos os dias.",
  RED));

children.push(h2("8.4. Tabelas nativas envolvidas"));
children.push(dataTable(
  ["Tabela", "Uso", "Descrição"],
  [
    ["TFPFER", "Leitura", "Períodos de férias. PK: CODEMP + CODFUNC + DTINIAQUI + SEQUENCIA."],
    ["TFPFUN", "Leitura", "Cadastro do funcionário. Inclui os campos customizados AD_LIDER e AD_EMAILLIDER."],
    ["TFPDEP", "Leitura", "Departamento."],
    ["TFPCAR", "Leitura", "Cargo."],
    ["TSIEMP", "Leitura", "Empresas."],
    ["TFPREQ", "Leitura", "Requisição de férias. STATUS 1 = pendente, 2 = aprovada."],
    ["TFPREQADM", "Leitura", "Dados de admissão da requisição. Junção por ADM.ID = REQ.ORIGEMID."],
    ["TSIAVI", "Escrita (via procedure)", "Central de notificações (pop-up/sino)."],
    ["TSIGRU", "Leitura", "Grupos de usuário. Necessária para confirmar o CODGRUPO do DP."],
    ["TMDFMG", "Escrita (INSERT)", "Fila de e-mail nativa. O despachante do Sankhya processa o envio."],
    ["TDDOPC", "Leitura", "Domínio de valores de SITUACAO e VINCULO."]
  ], [16, 22, 62]
));

children.push(h2("8.5. Relacionamentos"));
children.push(...codeBlock([
  "  TSIEMP (CODEMP)",
  "     |",
  "     +--< TFPFUN (CODEMP, CODFUNC)",
  "            |  +--> TFPDEP (CODDEP)          [LEFT]",
  "            |  +--> TFPCAR (CODCARGO)        [LEFT]",
  "            |",
  "            +--< TFPFER (CODEMP, CODFUNC, DTINIAQUI, SEQUENCIA)",
  "            |",
  "            +--< TFPREQ (CODFUNC)  ---> TFPREQADM (ADM.ID = REQ.ORIGEMID)",
  "                    STATUS = 1 -> pendente  : ENVIAR_SINO = 'N'",
  "                    STATUS = 2 -> aprovada  : sai da view (NOT EXISTS)",
  "",
  "  Objetos customizados:",
  "     AD_FERIAS_NOTIFICADO (CODEMP, CODFUNC, DTINIAQUI)  -- dedup do sino",
  "     AD_FERIAS_CONFIG     (PARAMETRO)                   -- parametros",
  "",
  "  Saidas:",
  "     TSIAVI  <- STP_NOTIFICA_SISTEMA_CUSTOM   (pop-up / sino)",
  "     TMDFMG  <- INSERT direto pelo job        (fila de e-mail)"
]));

/* ================= 9. APIS ================= */
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(h1("9. APIs e integrações envolvidas"));
children.push(p("Não há integração com sistemas externos. Todas as integrações são internas ao ecossistema Sankhya."));

children.push(h2("9.1. Consulta de dados do painel — DbExplorerSP.executeQuery"));
children.push(kvTable([
  ["Serviço", "DbExplorerSP.executeQuery (MGE)"],
  ["Endpoint", "/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json"],
  ["Método", "POST"],
  ["Autenticação", "Sessão corrente do Sankhya (o gadget roda dentro do ERP)"],
  ["Procedência", "CONFIRMADO — variante em uso"]
]));
children.push(h3("Payload e retorno"));
children.push(p(["A requisição envia a instrução SQL a executar. A resposta é lida em ",
  mono("responseBody.rows"), ", com o descritor de colunas em ", mono("fieldsMetadata"), "."]));
children.push(h3("Regras de implementação da tela"));
children.push(bullet(["Fila anti-concorrência (", mono("filaDb"), ") — serializa as chamadas ao serviço."]));
children.push(bullet(["Decodificação ", mono("UTF-8 → ISO-8859-1"), " no retorno, para correção de acentuação."]));
children.push(bullet(["Datas trafegadas via ", mono("TO_CHAR(..., 'YYYY-MM-DD\"T\"HH24:MI:SS')"), ", evitando ambiguidade de formato."]));
children.push(spacer(100));
children.push(callout("Variante alternativa existente",
  "A documentação registra DUAS variantes de integração da tela: (a) DbExplorerSP.executeQuery, descrita acima; e (b) um Action Button Java dedicado (AlertaFeriasVencerAction) exposto em /mge/service.sbr?serviceName=ACTIONBUTTON.alertaFeriasVencer, que recebe um payload JSON com diasAntecedencia, codEmp, codDep e codFunc. A regra de negócio é a mesma; muda apenas o transporte. Confirmar qual variante está publicada no ambiente antes de manutenção.",
  NAVY));

children.push(h2("9.2. Envio de e-mail — fila nativa TMDFMG"));
children.push(p([
  "O job ", strong("não envia e-mail diretamente"), ". Ele ", strong("enfileira"),
  " o e-mail na tabela nativa ", mono("TMDFMG"), " com ", mono("STATUS = 'Pendente'"),
  ", e o despachante nativo do Sankhya realiza o envio SMTP."
]));
children.push(h3("Instrução de enfileiramento"));
children.push(...codeBlock([
  "INSERT INTO TMDFMG (CODFILA, DTENTRADA, STATUS, CODCON, CODSMTP, TENTENVIO,",
  "                    MAXTENTENVIO, TIPOENVIO, REENVIAR, CODUSU, ASSUNTO,",
  "                    EMAIL, MENSAGEM)",
  "SELECT NVL(MAX(CODFILA),0)+1, SYSDATE, ?, ?, ?, 0, 3, 'E', 'N', 0, ?, ?, ?",
  "FROM TMDFMG"
]));
children.push(spacer(120));
children.push(dataTable(
  ["Campo", "Valor", "Observação"],
  [
    ["STATUS", "'Pendente'", "Valor que o despachante nativo procura para processar."],
    ["CODCON", "0", "Conta de e-mail. Valores 0, 168 e 143 observados em envios bem-sucedidos."],
    ["CODSMTP", "11", "Servidor SMTP do DP."],
    ["TENTENVIO / MAXTENTENVIO", "0 / 3", "Controle de tentativas."],
    ["TIPOENVIO / REENVIAR", "'E' / 'N'", "Tipo de envio e flag de reenvio."],
    ["EMAIL", "1 registro por destinatário", "A lista é dividida por ; ou , e inserida linha a linha."]
  ], [26, 24, 50]
));
children.push(spacer(120));
children.push(h3("Estados da fila"));
children.push(dataTable(
  ["Status", "Significado"],
  [
    ["Pendente", "Aguardando processamento pelo despachante."],
    ["Em processo", "Em envio."],
    ["Sucesso: Enviada", "Envio concluído — status observado na homologação."],
    ["Erro: Não Enviada", "Falha no envio."]
  ], [30, 70]
));
children.push(spacer(120));
children.push(callout("Descoberta de ambiente relevante para sustentação",
  "A tabela de contas SMTP TSICON NÃO existe neste ambiente (retorna ORA-00942). A forma robusta de descobrir CODCON e CODSMTP válidos é consultar a própria TMDFMG filtrando por STATUS = 'Sucesso: Enviada' e pelo servidor desejado, espelhando uma linha que já saiu com sucesso — foi assim que os valores em uso foram determinados (referência: CODFILA 1333886).",
  NAVY));

children.push(h2("9.3. Drill-through — abertura da tela de Requisições"));
children.push(kvTable([
  ["Tela de destino", "Pessoal+ » Rotinas Folha » Requisições"],
  ["Resource ID", "br.com.sankhya.rh.Requisicoes"],
  ["Global ID", "BFF43734574F1D0937C6FA91C0FF9D58"],
  ["Procedência", "CONFIRMADO — validado no ambiente"]
]));
children.push(p("A navegação ocorre em três etapas, com verificação efetiva de resultado:"));
children.push(num(["Localizar o objeto ", mono("workspace"), " ", strong("descendo"), " a partir do topo por todos os iframes (",
  mono("top → querySelectorAll('iframe') → contentWindow.workspace"), "). O objeto ",
  strong("não está"), " na cadeia de frames-pai do gadget."]));
children.push(num(["Chamar ", mono("workspace.openActivityResourceID(resourceID)"), " e ",
  strong("verificar se uma aba foi efetivamente criada"), ", comparando a contagem de abas antes e depois."]));
children.push(num(["Não havendo nova aba, navegar a ", strong("própria aba do navegador"), " para ",
  mono("system.jsp#app/<base64(resourceID)>"), ". Por ser a mesma aba, o ", mono("sessionStorage"),
  " é preservado e a sessão não é perdida."]));
children.push(spacer(100));
children.push(callout("Armadilha documentada — não repetir",
  "A chamada workspace.openActivityResourceID executa SEM lançar exceção e, ainda assim, pode não abrir a tela neste ambiente. A ausência de erro não constitui prova de abertura. A verificação válida é a contagem de abas. Adicionalmente: abrir em NOVA aba do navegador zera o sessionStorage e leva à tela de login; e alterar apenas location.hash, sem navegação, não roteia a SPA.",
  AMBER));

children.push(h2("9.4. Tratamento de erros das integrações"));
children.push(dataTable(
  ["Integração", "Falha possível", "Tratamento"],
  [
    ["TMDFMG (e-mail)", "Erro no INSERT ou na conexão", "try/catch isolado: não interrompe sino/pop-up. Log com cadeia de causas."],
    ["Procedure (sino)", "Erro PL/SQL", "Sem bloco EXCEPTION na procedure. O erro sobe para a rotina Java."],
    ["DbExplorerSP (painel)", "Retorno não-JSON (HTML de login)", "Sintoma típico: \"Unexpected token '<'\". Indica sessão expirada."],
    ["Drill-through", "Método nativo não abre a tela", "Fallback por deep-link na mesma aba, após verificação por contagem de abas."]
  ], [22, 30, 48]
));

/* ================= 10. REGRAS ================= */
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(h1("10. Regras de negócio identificadas"));

children.push(h2("10.1. Critérios de elegibilidade"));
children.push(p(["Entra no alerta quem atende a ", strong("pelo menos um"), " dos critérios:"]));
children.push(dataTable(
  ["Critério", "Definição", "Racional"],
  [
    ["A — Limite de gozo próximo", "Período aquisitivo em aberto a 30 dias ou menos do limite de gozo, INCLUSIVE já vencido (dias negativos).", "O alerta não desaparece porque o prazo passou: o problema continua existindo e o passivo cresce."],
    ["B — Risco de acumular (preventivo)", "Exatamente 1 período aquisitivo em aberto, com o 2º ciclo (ADD_MONTHS(DTFINAQUI,12)) completando na janela de -30 a +30 dias.", "Antecipa o momento em que um 2º período acumulado seria gerado, situação vedada pela CLT."]
  ], [22, 40, 38]
));
children.push(spacer(120));
children.push(callout("Correção de 08/07/2026 — piso de -30 dias",
  "A janela do critério B possui piso de -30 dias. Sem esse piso, a consulta capturava registros órfãos: períodos em aberto há anos, nunca quitados, que poluíam a lista e reduziam a confiança do DP no alerta.",
  NAVY));

children.push(h2("10.2. Regra de vencimento"));
children.push(bullet([mono("TFPFER.DTFINAQUI"), " é o ", strong("fim do período aquisitivo"), "."]));
children.push(bullet([mono("DTFINAQUI + 330"), " aproxima o ", strong("fim do período concessivo"), " (~12 meses da CLT)."]));
children.push(bullet(["A coluna derivada ", mono("LIMGOZO"), " calculada de forma mais precisa seria ",
  mono("ADD_MONTHS(DTFINAQUI,12) - (NUMDIASFER+10) + 1"), "."]));
children.push(bullet(["No job Java o critério equivalente utiliza ", mono("DTLIMGOZFER"),
  " — ", strong("as duas definições precisam ser alinhadas"), " para que a data de vencimento seja idêntica no painel e no e-mail."]));

children.push(h2("10.3. Requisição de férias e encerramento do alerta"));
children.push(dataTable(
  ["Situação", "E-mail", "Pop-up", "Sininho", "Permanece na view?"],
  [
    ["Sem requisição", "Sim", "Sim", "Sim", "Sim"],
    ["Requisição PENDENTE (STATUS = 1)", "Sim", "Sim", "Não", "Sim"],
    ["Requisição APROVADA (STATUS = 2)", "Não", "Não", "Não", "Não — sai pelo NOT EXISTS"]
  ], [34, 14, 14, 14, 24]
));
children.push(spacer(100));
children.push(p([
  "A exclusão do sininho para requisições pendentes é implementada pela flag ", mono("ENVIAR_SINO"),
  " da view: o lembrete continua no e-mail e no pop-up até a aprovação, mas não gera aviso persistente — evitando ruído sobre um caso já em tratamento."
]));

children.push(h2("10.4. Deduplicação e canais"));
children.push(bullet([strong("Um aviso de sininho por colaborador"), " — decisão fechada com o key user, para não gerar bloco de texto extenso dentro de um único aviso."]));
children.push(bullet([strong("E-mail pode ser concatenado"), " — a lista completa vai em um corpo só."]));
children.push(bullet([strong("Deduplicação por funcionário:"), " quando o mesmo ", mono("CODFUNC"),
  " aparece em mais de um período na janela, mantém-se somente o de ", strong("menor DIAS_PARA_VENCER"), " (mais urgente)."]));
children.push(bullet([strong("Agrupamento por líder pelo e-mail"), " (", mono("AD_EMAILLIDER"),
  "), nunca pelo nome — evita ambiguidade de homônimos. Líder sem e-mail cadastrado gera um aviso ao DP."]));

children.push(h2("10.5. Faixas de urgência do painel"));
children.push(dataTable(
  ["Faixa", "Condição (dias para vencer)", "Tratamento visual"],
  [
    ["Risco de acumular", "dias < 0", "Rosa"],
    ["Crítico", "0 a 15", "Vermelho claro"],
    ["Atenção", "16 a 30", "Âmbar"],
    ["Dentro do prazo", "> 30", "Neutro"]
  ], [26, 38, 36]
));

/* ================= 11. EVIDÊNCIAS ================= */
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(h1("11. Evidências e roteiro de homologação"));

children.push(h2("11.1. Resultado da homologação"));
children.push(p(["Ambiente: ", strong("erp-hml"), ". Itens validados:"]));
children.push(dataTable(
  ["Item validado", "Evidência registrada"],
  [
    ["Pop-up exibido ao DP", "Aviso apresentado com importância Urgentíssimo."],
    ["Sininho exibido ao DP", "Aviso persistente na central de notificações."],
    ["Navegação sininho → painel", "Link do aviso abre o painel."],
    ["Painel: filtros, KPIs, detalhe", "Filtros de empresa/departamento/funcionário/antecedência; 4 KPIs clicáveis; accordion de detalhe."],
    ["Painel: drill-through", "Botão \"Abrir requisição de férias\" abre a tela de Requisições na mesma sessão."],
    ["E-mail por líder", "Entregue, contendo apenas a equipe do líder."],
    ["E-mail consolidado ao DP", "Entregue pela conta do DP."],
    ["Status da fila de e-mail", "STATUS = 'Sucesso: Enviada' na TMDFMG."],
    ["Layout e acentuação", "Identidade Voke aplicada; acentuação correta (compilação UTF-8)."]
  ], [34, 66]
));
children.push(spacer(120));
children.push(callout("Observação sobre as evidências",
  "As evidências acima constam como validadas na documentação consolidada do projeto. Os arquivos de evidência propriamente ditos (capturas de tela, extrações da TMDFMG, logs de execução) NÃO foram fornecidos para esta análise e devem ser anexados à GMUD a partir do repositório de evidências do projeto.",
  AMBER));

children.push(h2("11.2. Roteiro de homologação"));
children.push(p([strong("Pré-condição: "), "executar com ", mono("MODO_TESTE = 'S'"),
  " e ", mono("EMAIL_TESTE"), " preenchido, de modo que nenhum e-mail alcance gestores durante os testes."]));
children.push(dataTable(
  ["#", "Teste", "Resultado esperado"],
  [
    ["1", "Executar a Ação Agendada manualmente.", "Rotina conclui sem exceção; log registra a quantidade de alertas."],
    ["2", "Conferir a fila de e-mail: SELECT * FROM TMDFMG ORDER BY CODFILA DESC.", "Registros criados com STATUS 'Pendente' e, após o despachante, 'Sucesso: Enviada'."],
    ["3", "Conferir o assunto no modo teste.", "Assunto no formato [TESTE -> destinatario_real] Assunto original."],
    ["4", "Conferir o pop-up e o sininho no usuário do grupo do DP.", "Aviso apresentado com importância Urgentíssimo."],
    ["5", "Reexecutar a rotina no mesmo dia (modo DIFF).", "Não duplica o aviso de sino (AD_FERIAS_NOTIFICADO em funcionamento)."],
    ["6", "Abrir o painel e aplicar filtros e KPIs.", "Lista filtra corretamente; contadores dos KPIs permanecem sobre o total da faixa."],
    ["7", "Expandir uma linha do painel.", "Accordion exibe empresa, departamento, cargo, dias, aquisitivo, abono e faltas."],
    ["8", "Acionar \"Abrir requisição de férias\".", "Tela de Requisições abre na mesma sessão, sem exigir novo login."],
    ["9", "Exportar CSV.", "Arquivo gerado com separador ; e charset utf-8."],
    ["10", "Criar requisição PENDENTE para um colaborador da lista.", "Permanece no e-mail e pop-up; deixa de gerar sininho (ENVIAR_SINO = 'N')."],
    ["11", "APROVAR a requisição desse colaborador.", "Colaborador sai da view e cessa em todos os canais."],
    ["12", "Conferir um líder sem e-mail cadastrado.", "DP recebe o aviso \"Líderes sem e-mail cadastrado\"."]
  ], [6, 44, 50]
));
children.push(spacer(120));
children.push(callout("Consulta de apoio para a validação da fila",
  "Para localizar valores válidos de CODCON e CODSMTP, ou para conferir envios: SELECT CODFILA, STATUS, CODCON, CODSMTP, EMAIL, ASSUNTO FROM TMDFMG WHERE STATUS = 'Sucesso: Enviada' ORDER BY CODFILA DESC.",
  NAVY));

/* ================= 12. IMPLANTAÇÃO ================= */
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(h1("12. Plano de implantação em produção"));

children.push(h2("12.1. Pré-requisitos"));
children.push(dataTable(
  ["#", "Pré-requisito", "Status"],
  [
    ["1", "Confirmar o CODGRUPO real do DP (TSIGRU) e substituir o placeholder 123.", "PENDENTE — bloqueante"],
    ["2", "Obter a DDL definitiva de AD_FERIAS_NOTIFICADO.", "PENDENTE — bloqueante"],
    ["3", "Confirmar a assinatura da interface de agendamento do Cuckoo.jar.", "PENDENTE — bloqueante"],
    ["4", "Confirmar o nome JNDI do datasource.", "PENDENTE — bloqueante"],
    ["5", "Confirmar CODCON/CODSMTP válidos em produção pela TMDFMG.", "A validar no ambiente"],
    ["6", "Confirmar com o RH a régua de vencimento (330 dias fixos).", "A validar com o negócio"],
    ["7", "Garantir permissão de acesso do usuário do DP à tela de Requisições.", "A validar no ambiente"],
    ["8", "Compilar o .jar em UTF-8.", "Obrigatório"]
  ], [6, 64, 30]
));
children.push(spacer(120));
children.push(callout("Condição de entrada em produção",
  "Os pré-requisitos 1 a 4 são bloqueantes. Os itens 1 e 2 produzem falhas SILENCIOSAS: um CODGRUPO incorreto entrega o aviso ao grupo errado sem gerar erro, e a ausência de AD_FERIAS_NOTIFICADO faz o modo DIFF duplicar avisos diariamente sem qualquer alerta de falha. Recomenda-se não agendar a janela de GMUD antes do fechamento desses quatro itens.",
  RED));

children.push(h2("12.2. Sequência de implantação"));
children.push(dataTable(
  ["#", "Etapa", "Comando / Ação", "Responsável"],
  [
    ["1", "Backup dos objetos existentes", "Extrair DDL atual de VW_ALERTA_FERIAS_A_VENCER e STP_NOTIFICA_SISTEMA_CUSTOM, se já existirem.", "DBA"],
    ["2", "Criar tabelas customizadas", "CREATE TABLE AD_FERIAS_CONFIG; CREATE TABLE AD_FERIAS_NOTIFICADO.", "DBA"],
    ["3", "Popular parâmetros", "INSERT em AD_FERIAS_CONFIG, com MODO_TESTE = 'S' nesta etapa.", "DBA"],
    ["4", "Criar a view", "CREATE OR REPLACE VIEW VW_ALERTA_FERIAS_A_VENCER.", "DBA"],
    ["5", "Criar a procedure", "CREATE OR REPLACE PROCEDURE STP_NOTIFICA_SISTEMA_CUSTOM, com o CODGRUPO real.", "DBA"],
    ["6", "Publicar a tela HTML5", "Importar o pacote do painel no Sankhya.", "Consultor Sankhya"],
    ["7", "Publicar o .jar", "Subir o .jar de customização (compilado em UTF-8).", "Consultor Sankhya"],
    ["8", "Cadastrar a Ação Agendada", "Tipo Java, classe AlertaFeriasNotificacao, gatilho CRON diário.", "Consultor Sankhya"],
    ["9", "Autorizar a customização", "Autorização de Customização — obrigatória na 1ª ativação e após qualquer alteração de classe.", "Administrador Sankhya"],
    ["10", "Executar em modo teste", "Disparo manual com MODO_TESTE = 'S'; validar fila, pop-up e sino.", "Consultor + DP"],
    ["11", "Virar para produção", "UPDATE AD_FERIAS_CONFIG SET VALOR='N' WHERE PARAMETRO='MODO_TESTE'; popular DESTINATARIOS_DP.", "Consultor Sankhya"],
    ["12", "Monitorar 1º ciclo", "Acompanhar a primeira execução automática e a fila TMDFMG.", "Consultor + DP"]
  ], [6, 22, 52, 20]
));
children.push(spacer(120));
children.push(callout("Ponto crítico frequentemente esquecido — Autorização de Customização",
  "Ações Agendadas do tipo Java no Sankhya exigem autorização do administrador em \"Autorização de Customização\" na primeira ativação e APÓS QUALQUER ALTERAÇÃO DE CLASSE. Sem essa autorização a ação permanece cadastrada e aparentemente ativa, porém NUNCA dispara — sem mensagem de erro. É a causa mais provável de \"a rotina não rodou\" após um deploy.",
  RED));
children.push(spacer(100));
children.push(callout("Estratégia de virada adotada no projeto",
  "A Fase 1 (piloto) rodou com MODO_TESTE = 'S' e EMAIL_TESTE único, com o assunto exibindo o destinatário real — por exemplo: [TESTE -> fellipe.mota@voke.tech] Sua equipe com férias a vencer. Isso permitiu validar o roteamento por líder sem contaminar a caixa dos gestores. A virada para produção consistiu apenas em alterar MODO_TESTE para 'N' e popular DESTINATARIOS_DP, SEM recompilar o .jar.",
  GREEN));

children.push(h2("12.3. Troubleshooting conhecido de implantação"));
children.push(dataTable(
  ["Sintoma", "Causa", "Correção"],
  [
    ["Erro \"pacote vazio, sem membros públicos\" ao criar a procedure", "Objeto remanescente do tipo PACKAGE com o mesmo nome no schema.", "SELECT OBJECT_NAME, OBJECT_TYPE FROM USER_OBJECTS WHERE OBJECT_NAME='STP_NOTIFICA_SISTEMA_CUSTOM'; depois DROP PACKAGE antes do CREATE."],
    ["ORA-00904 em coluna da TSIAVI", "Uso de CODUSUREMETENTE, que não existe.", "A grafia real da coluna é CODUSUREMENTI."],
    ["ORA-00942 ao consultar TSICON", "A tabela de contas SMTP não existe neste ambiente.", "Obter CODCON/CODSMTP consultando a própria TMDFMG por STATUS='Sucesso: Enviada'."],
    ["Rotina cadastrada mas não dispara", "Falta de Autorização de Customização.", "Autorizar em Autorização de Customização (repetir após cada alteração de classe)."],
    ["Acentuação corrompida no e-mail", "Compilação fora de UTF-8.", "Recompilar o .jar em UTF-8."],
    ["Painel exibe \"Unexpected token '<'\"", "Retorno HTML (tela de login) no lugar de JSON.", "Sessão expirada ou serviço/endpoint incorreto. Reautenticar e conferir o serviço."],
    ["WARN ScheduledActionsSP.isActiveJob", "Log da plataforma, não da customização.", "Nenhuma ação. Não impede a execução."]
  ], [26, 30, 44]
));

/* ================= 13. ROLLBACK ================= */
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(h1("13. Plano de rollback"));
children.push(p("O desenvolvimento é aditivo: cria objetos novos e não altera objetos nativos do produto. Isso torna o rollback simples e de baixo risco."));

children.push(h2("13.1. Rollback imediato (contenção em minutos)"));
children.push(p([strong("Cenário: "), "a rotina está enviando notificações indevidas e é preciso interromper imediatamente, sem desfazer a implantação."]));
children.push(dataTable(
  ["#", "Ação", "Efeito"],
  [
    ["1", "Desativar a Ação Agendada na tela de Ações Agendadas.", "Interrompe imediatamente todos os disparos. É a contenção mais rápida."],
    ["2", "Alternativa: UPDATE AD_FERIAS_CONFIG SET VALOR='S' WHERE PARAMETRO='MODO_TESTE'.", "Mantém a rotina ativa, porém redireciona todos os e-mails para EMAIL_TESTE."],
    ["3", "Alternativa: UPDATE AD_FERIAS_CONFIG SET VALOR='N' WHERE PARAMETRO='ENVIAR_POR_LIDER'.", "Desliga apenas o e-mail por líder, preservando o consolidado do DP."]
  ], [6, 52, 42]
));
children.push(spacer(120));
children.push(callout("Recomendação de contenção",
  "Preferir a desativação da Ação Agendada (item 1) como primeira medida: é reversível, imediata e não exige alteração de dados. Os itens 2 e 3 são úteis quando se deseja preservar parte da funcionalidade.",
  NAVY));

children.push(h2("13.2. Rollback completo"));
children.push(dataTable(
  ["#", "Ação", "Comando / Procedimento"],
  [
    ["1", "Desativar e excluir a Ação Agendada.", "Tela de Ações Agendadas do Sankhya."],
    ["2", "Remover o .jar de customização.", "Procedimento padrão de despublicação do ambiente."],
    ["3", "Despublicar a tela HTML5.", "Remover o componente do Sankhya."],
    ["4", "Remover a procedure.", "DROP PROCEDURE STP_NOTIFICA_SISTEMA_CUSTOM;"],
    ["5", "Remover a view.", "DROP VIEW VW_ALERTA_FERIAS_A_VENCER;"],
    ["6", "Remover as tabelas customizadas.", "DROP TABLE AD_FERIAS_NOTIFICADO; DROP TABLE AD_FERIAS_CONFIG;"]
  ], [6, 40, 54]
));
children.push(spacer(120));
children.push(callout("Avaliação de impacto do rollback",
  "Nenhum objeto NATIVO do Sankhya é alterado por esta implantação. A procedure customizada é uma CÓPIA (STP_NOTIFICA_SISTEMA_CUSTOM), preservando intacta a nativa STP_NOTIFICA_SISTEMA. As gravações realizadas em TSIAVI (avisos já emitidos) e em TMDFMG (e-mails já enfileirados ou enviados) PERMANECEM após o rollback — são registros históricos e não requerem expurgo. Caso se deseje remover avisos pendentes, tratá-los pela própria central de notificações.",
  GREEN));
children.push(spacer(100));
children.push(callout("Ordem de remoção",
  "Remover primeiro a Ação Agendada e o .jar, e somente depois os objetos de banco. A ordem inversa faria a rotina falhar em execução por referência a objeto inexistente, gerando erro na tela de Ações Agendadas.",
  AMBER));

/* ================= 14. GMUD ================= */
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(new Paragraph({ spacing: { after: 20 },
  children: [new TextRun({ text: "DOCUMENTO DE GMUD", bold: true, color: NAVY, size: 34, font: "Arial" })] }));
children.push(new Paragraph({ spacing: { after: 170 },
  border: { bottom: { color: NAVY, space: 6, style: BorderStyle.SINGLE, size: 8 } },
  children: [new TextRun({ text: "Alerta de Férias a Vencer — ERP Sankhya Om", color: PINK, size: 24, font: "Arial", bold: true })] }));

children.push(kvTable([
  ["Sistema", "ERP Sankhya Om"],
  ["Módulo", "Recursos Humanos / Departamento Pessoal"],
  ["Tipo de mudança", "Implantação de nova funcionalidade (aditiva)"],
  ["Período de execução", "A DEFINIR"],
  ["Duração estimada", "A DEFINIR"],
  ["ICs afetados", "ERP SANKHYA"],
  ["Ambiente de origem", "erp-hml (homologado)"],
  ["Solicitante", "Departamento Pessoal"],
  ["Executor", "A DEFINIR"]
]));
children.push(spacer(120));
children.push(callout("Campos a completar antes do envio",
  "Período de execução, duração estimada, executor e responsáveis pela aprovação não constam no material analisado e foram deixados como A DEFINIR. Preencher conforme a janela acordada com a operação.",
  AMBER));

children.push(h2("1. Objetivo"));
children.push(p("Implantar a solução de Alerta de Férias a Vencer no ERP Sankhya Om, automatizando a identificação e a notificação de colaboradores cujo limite de gozo de férias se aproxima do vencimento, por meio de pop-up, notificação no sininho, e-mail ao Departamento Pessoal, e-mail individual por líder e painel de consulta HTML5."));

children.push(h2("2. Justificativa"));
children.push(p([
  "A CLT determina que férias não concedidas dentro do período concessivo passam a ser devidas ",
  strong("em dobro"), ". O acompanhamento manual dos períodos aquisitivos não oferece garantia de tempestividade, expondo a empresa a ",
  strong("passivo trabalhista evitável"), "."
]));
children.push(p("A mudança elimina a dependência de conferência manual, estabelecendo notificação automática diária com antecedência de 90 dias, e mantém o alerta ativo até que o período de férias seja efetivamente definido — encerrando-se automaticamente na sequência."));

children.push(h2("3. Objetos implantados"));
children.push(dataTable(
  ["Objeto", "Tipo", "Operação"],
  [
    ["VW_ALERTA_FERIAS_A_VENCER", "View Oracle", "CREATE OR REPLACE"],
    ["STP_NOTIFICA_SISTEMA_CUSTOM", "Procedure PL/SQL", "CREATE OR REPLACE"],
    ["AD_FERIAS_CONFIG", "Tabela", "CREATE TABLE + INSERT de parâmetros"],
    ["AD_FERIAS_NOTIFICADO", "Tabela", "CREATE TABLE"],
    ["AlertaFeriasNotificacao", "Classe Java (.jar)", "Publicação + cadastro de Ação Agendada"],
    ["Painel Alerta de Férias a Vencer", "Tela HTML5", "Publicação de componente"]
  ], [34, 26, 40]
));
children.push(spacer(100));
children.push(p([ital("Nenhum objeto nativo do produto é alterado. A procedure implantada é uma cópia customizada; a nativa STP_NOTIFICA_SISTEMA permanece intacta.")]));

children.push(h2("4. Procedimentos de implantação"));
children.push(num("Backup: extrair a DDL atual dos objetos customizados, caso já existam no ambiente."));
children.push(num(["Criar as tabelas ", mono("AD_FERIAS_CONFIG"), " e ", mono("AD_FERIAS_NOTIFICADO"), "."]));
children.push(num(["Popular ", mono("AD_FERIAS_CONFIG"), " com ", mono("MODO_TESTE = 'S'"), "."]));
children.push(num(["Criar a view ", mono("VW_ALERTA_FERIAS_A_VENCER"), "."]));
children.push(num(["Criar a procedure ", mono("STP_NOTIFICA_SISTEMA_CUSTOM"), " com o ", mono("CODGRUPO"), " real do DP."]));
children.push(num("Publicar a tela HTML5 do painel."));
children.push(num("Publicar o .jar de customização, compilado em UTF-8."));
children.push(num(["Cadastrar a Ação Agendada (Java), classe ", mono("AlertaFeriasNotificacao"), ", gatilho CRON diário."]));
children.push(num([strong("Conceder Autorização de Customização"), " — obrigatória para que a ação dispare."]));
children.push(num("Executar manualmente em modo teste e validar fila, pop-up e sininho."));
children.push(num(["Virar para produção: ", mono("MODO_TESTE = 'N'"), " e ", mono("DESTINATARIOS_DP"), " populado."]));
children.push(num("Monitorar o primeiro ciclo automático."));

children.push(h2("5. Validações"));
children.push(dataTable(
  ["#", "Validação", "Critério de aceite"],
  [
    ["1", "Execução manual da rotina", "Conclui sem exceção; log registra a quantidade de alertas."],
    ["2", "Fila de e-mail", "Registros em TMDFMG evoluem de 'Pendente' para 'Sucesso: Enviada'."],
    ["3", "Pop-up e sininho", "Aviso exibido ao grupo do DP com importância Urgentíssimo."],
    ["4", "Não duplicação", "Reexecução no mesmo dia não gera novo aviso de sino."],
    ["5", "Painel", "Filtros, KPIs, accordion e exportação CSV operando."],
    ["6", "Drill-through", "Tela de Requisições abre na mesma sessão, sem novo login."],
    ["7", "Requisição pendente", "Colaborador permanece em e-mail e pop-up e deixa de gerar sininho."],
    ["8", "Requisição aprovada", "Colaborador sai da view e cessa em todos os canais."],
    ["9", "E-mail por líder", "Cada líder recebe exclusivamente a sua equipe."],
    ["10", "Acentuação", "Caracteres acentuados corretos no e-mail e no aviso."]
  ], [6, 34, 60]
));

children.push(h2("6. Rollback"));
children.push(p([strong("Contenção imediata: "), "desativar a Ação Agendada na respectiva tela — interrompe todos os disparos em minutos, sem alteração de dados."]));
children.push(p([strong("Rollback completo: "), "desativar e excluir a Ação Agendada; remover o .jar; despublicar a tela HTML5; ",
  mono("DROP PROCEDURE STP_NOTIFICA_SISTEMA_CUSTOM"), "; ", mono("DROP VIEW VW_ALERTA_FERIAS_A_VENCER"), "; ",
  mono("DROP TABLE AD_FERIAS_NOTIFICADO"), "; ", mono("DROP TABLE AD_FERIAS_CONFIG"), "."]));
children.push(p([strong("Ordem: "), "remover primeiro a Ação Agendada e o .jar; somente depois os objetos de banco."]));
children.push(p([ital("Registros já gravados em TSIAVI e TMDFMG permanecem como histórico e não requerem expurgo. Nenhum objeto nativo é afetado.")]));

children.push(h2("7. Riscos e impactos"));
children.push(dataTable(
  ["Risco", "Prob.", "Impacto", "Mitigação"],
  [
    ["CODGRUPO do DP incorreto (placeholder 123)", "Alta", "Alto — aviso entregue ao grupo errado, sem erro visível", "Confirmar em TSIGRU antes da implantação. Bloqueante."],
    ["AD_FERIAS_NOTIFICADO ausente ou incorreta", "Alta", "Alto — duplicação diária de avisos de sino", "Obter a DDL definitiva e criar a tabela antes de ativar o modo DIFF. Bloqueante."],
    ["Assinatura do Cuckoo.jar divergente", "Alta", "Alto — a rotina não executa", "Confirmar a interface no ambiente real. Bloqueante."],
    ["Datasource JNDI incorreto", "Média", "Alto — falha de conexão", "Confirmar o nome do recurso no ambiente. Bloqueante."],
    ["Autorização de Customização não concedida", "Média", "Alto — ação nunca dispara, silenciosamente", "Incluir a autorização como passo formal do roteiro."],
    ["CODCON/CODSMTP inválidos", "Média", "Médio — e-mail não sai", "Espelhar linha da TMDFMG com STATUS 'Sucesso: Enviada'."],
    ["Régua de 330 dias divergente da regra do RH", "Média", "Médio — alerta antecipado ou tardio", "Validar a régua com o RH; avaliar LIMGOZO calculado."],
    ["Divergência entre a view e a consulta do job", "Média", "Médio — painel e e-mail discordam", "Alinhar LIMGOZO e DTLIMGOZFER; versionar as duas regras em conjunto."],
    ["Volume inicial elevado de e-mails", "Média", "Baixo — ruído no primeiro ciclo", "Executar a Fase 1 em MODO_TESTE antes da virada."],
    ["Compilação fora de UTF-8", "Baixa", "Baixo — acentuação corrompida", "Padronizar a compilação em UTF-8."],
    ["Race condition em NUAVISO (MAX+1)", "Baixa", "Baixo — colisão em chamadas concorrentes", "Risco herdado da procedure nativa, aceito nesta versão."]
  ], [30, 10, 28, 32]
));

children.push(h2("8. Impacto operacional durante a janela"));
children.push(p([
  "A implantação é ", strong("aditiva"), " e não altera rotinas existentes. ",
  "A criação dos objetos de banco e a publicação do painel não exigem indisponibilidade do ERP. ",
  "A publicação do ", mono(".jar"), " de customização segue o procedimento padrão do ambiente — ",
  strong("confirmar com a infraestrutura"), " se, nesta instalação, a publicação exige reinício do serviço e, em caso positivo, tratar a janela como indisponibilidade programada."
]));

/* ================= 15. PENDÊNCIAS ================= */
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(h1("15. Pendências em aberto"));
children.push(p("Consolidação das pendências, reconciliando os anexos com o estado atual documentado do projeto."));
children.push(dataTable(
  ["#", "Pendência", "Situação atual", "Bloqueia produção?"],
  [
    ["1", "Assinatura real da interface ScheduledAction (Cuckoo.jar)", "ABERTA — não documentada publicamente; exige inspeção do jar no ambiente.", "Sim"],
    ["2", "Mecanismo de envio de e-mail fora do contexto de botão", "RESOLVIDA — implementada via fila nativa TMDFMG, com envio confirmado ('Sucesso: Enviada').", "Não"],
    ["3", "CODGRUPO_DP — grupo de key users do DP", "ABERTA — placeholder (0 nos anexos, 123 na versão consolidada). Confirmar em TSIGRU.", "Sim"],
    ["4", "DDL definitiva de AD_FERIAS_NOTIFICADO", "ABERTA — chave lógica conhecida; DDL completa não fornecida.", "Sim"],
    ["5", "Nome JNDI do datasource", "ABERTA — depende do ambiente.", "Sim"],
    ["6", "Régua de vencimento (330 dias fixos)", "ABERTA — validar com o RH; avaliar LIMGOZO calculado.", "Não — risco funcional"],
    ["7", "Alinhamento LIMGOZO (view) x DTLIMGOZFER (job)", "ABERTA — risco de divergência entre painel e e-mail.", "Não — risco funcional"],
    ["8", "Migração das constantes Java para AD_FERIAS_CONFIG", "ABERTA — recomendação de melhoria.", "Não"],
    ["9", "Parametrização dos números mágicos (330 e 90 dias)", "ABERTA — hardcoded.", "Não"]
  ], [6, 34, 44, 16]
));
children.push(spacer(140));
children.push(callout("Reconciliação com os documentos anexados",
  "O README.md e o CLAUDE.md fornecidos listam três pendências. Desta análise resulta que a de nº 2 (mecanismo de e-mail) já foi RESOLVIDA por meio da fila nativa TMDFMG, com evidência de envio bem-sucedido registrada na homologação. As de nº 1 e nº 3 permanecem abertas. Foram identificadas seis pendências adicionais não listadas naqueles documentos, das quais duas (itens 4 e 5) são igualmente bloqueantes para produção.",
  AMBER));

children.push(new Paragraph({ spacing: { before: 300 }, children: [
  new TextRun({ text: "Documento gerado para passagem de conhecimento e anexo de GMUD. Elaborado a partir da documentação consolidada do projeto e dos arquivos README.md e CLAUDE.md fornecidos. Os artefatos-fonte (.java, .sql, atas, requisitos e evidências) não foram disponibilizados para esta análise; os trechos de código apresentados provêm da documentação consolidada e devem ser conferidos contra os arquivos definitivos antes da implantação.",
    italics: true, color: GRAY, size: 17, font: "Arial" })] }));

/* ================= DOCUMENTO ================= */
const doc = new Document({
  numbering: { config: [{
    reference: "passos",
    levels: [{ level: 0, format: "decimal", text: "%1.", alignment: AlignmentType.START,
      style: { paragraph: { indent: { left: 420, hanging: 260 } } } }]
  }]},
  styles: { default: { document: { run: { font: "Arial", size: 22 } } } },
  sections: [{
    properties: { page: {
      size: { width: 11906, height: 16838 },
      margin: { top: 2500, right: 1100, bottom: 1500, left: 1100 }
    }},
    headers: { default: new Header({ children: [new Paragraph({ children: [new ImageRun({
      type: "png", data: letterhead,
      transformation: { width: 595, height: 842 },
      floating: {
        horizontalPosition: { offset: 0 },
        verticalPosition: { offset: -300000 },
        behindDocument: true, wrap: { type: "none" }
      }
    })]})]})},
    footers: { default: new Footer({ children: [new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: "Página ", size: 16, color: GRAY, font: "Arial" }),
                 new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GRAY, font: "Arial" }),
                 new TextRun({ text: " de ", size: 16, color: GRAY, font: "Arial" }),
                 new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: GRAY, font: "Arial" })]
    })]})},
    children
  }]
});

Packer.toBuffer(doc).then(buf => {
  const out = "/tmp/claude-0/-home-user-Claude-Repos/228027ca-009e-574e-b468-a52395ef698f/scratchpad/Documentacao-Alerta-Ferias-a-Vencer.docx";
  fs.writeFileSync(out, buf);
  console.log("OK gerado:", out, buf.length, "bytes");
});
