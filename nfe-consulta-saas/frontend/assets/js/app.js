/* ============================================================
   Lógica de interface — orquestra consulta, exibição e PDF.
   ============================================================ */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  let notaAtual = null;

  const fmtMoeda = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fmtData = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return isNaN(d) ? iso : d.toLocaleString("pt-BR");
  };
  const escapeHtml = (s) => String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  /** Aplica máscara visual em blocos de 4 dígitos. */
  function mascararChave(digitos) {
    return (digitos.match(/.{1,4}/g) || []).join(" ");
  }

  // ---- Input: contador + máscara ----
  $("chave").addEventListener("input", (e) => {
    const d = NfeApi.somenteDigitos(e.target.value).slice(0, 44);
    e.target.value = mascararChave(d);
    $("contadorDigitos").textContent = d.length;
    $("chaveErro").classList.add("d-none");
  });

  $("btnExemplo").addEventListener("click", () => {
    $("chave").value = mascararChave(window.NFE_MOCK.chave);
    $("contadorDigitos").textContent = 44;
  });

  // ---- Submit da consulta ----
  $("formConsulta").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("alertaErro").classList.add("d-none");

    const val = NfeApi.validarChave($("chave").value);
    if (!val.ok) {
      const erro = $("chaveErro");
      erro.textContent = val.msg;
      erro.classList.remove("d-none");
      return;
    }

    setLoading(true);
    try {
      notaAtual = await NfeApi.consultar(val.chave);
      renderizar(notaAtual);
    } catch (err) {
      mostrarErro(err.message || "Falha na consulta.");
    } finally {
      setLoading(false);
    }
  });

  function setLoading(on) {
    $("btnConsultar").disabled = on;
    $("spinnerBtn").classList.toggle("d-none", !on);
  }

  function mostrarErro(msg) {
    const a = $("alertaErro");
    a.textContent = msg;
    a.classList.remove("d-none");
  }

  // ---- Renderização da nota ----
  function renderizar(n) {
    $("telaConsulta").classList.add("d-none");
    $("alertaErro").classList.add("d-none");
    $("telaResultado").classList.remove("d-none");

    // Status
    const badge = $("badgeStatus");
    const st = (n.status || "").toUpperCase();
    badge.textContent = st;
    badge.className = "badge-status " +
      (st === "AUTORIZADA" ? "autorizada" : st === "CANCELADA" ? "cancelada" : "denegada");

    $("dNumero").textContent = n.numero;
    $("dSerie").textContent = n.serie;
    $("dChave").textContent = mascararChave(n.chave);
    $("dValorTotal").textContent = fmtMoeda(n.valorTotal);
    $("dEmitente").textContent = n.emitente.nome;
    $("dCnpjEmit").textContent = n.emitente.cnpj;
    $("dDestinatario").textContent = n.destinatario.nome;
    $("dCnpjDest").textContent = n.destinatario.cnpj;
    $("dEmissao").textContent = fmtData(n.emissao);
    $("dNatureza").textContent = n.natureza || "—";
    $("dProtocolo").textContent = n.protocolo || "—";
    $("dDhProtocolo").textContent = fmtData(n.dhProtocolo);

    // Produtos
    $("dProdutos").innerHTML = n.produtos.map(p => `
      <tr>
        <td>${p.item}</td>
        <td>${escapeHtml(p.descricao)}</td>
        <td class="text-muted small">${escapeHtml(p.ncm)}</td>
        <td class="text-end">${p.qtd}</td>
        <td class="text-end">${fmtMoeda(p.unitario)}</td>
        <td class="text-end fw-semibold">${fmtMoeda(p.total)}</td>
      </tr>`).join("");

    // Impostos
    $("dImpostos").innerHTML = n.impostos.map(i => `
      <div class="col-6 col-md-3">
        <div class="text-muted small">${escapeHtml(i.nome)}</div>
        <div class="fw-semibold text-navy">${fmtMoeda(i.valor)}</div>
        <div class="text-muted" style="font-size:.72rem">Base ${fmtMoeda(i.base)}</div>
      </div>`).join("");

    // Totais
    $("dTotProd").textContent = fmtMoeda(n.totalProdutos);
    $("dTotImp").textContent = fmtMoeda(n.totalImpostos);
    $("dTotNota").textContent = fmtMoeda(n.valorTotal);

    // XML
    $("xmlConteudo").textContent = n.xml || "XML não disponível.";

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---- Ações ----
  $("btnVoltar").addEventListener("click", () => {
    $("telaResultado").classList.add("d-none");
    $("telaConsulta").classList.remove("d-none");
  });

  $("btnPdf").addEventListener("click", () => {
    if (notaAtual) NfePdf.gerar(notaAtual);
  });

  $("btnVerXml").addEventListener("click", () => {
    new bootstrap.Modal($("modalXml")).show();
  });

  $("btnCopiarXml").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(notaAtual?.xml || ""); } catch (_) {}
  });

  $("btnBaixarXml").addEventListener("click", () => {
    if (!notaAtual?.xml) return;
    const blob = new Blob([notaAtual.xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `NFe_${notaAtual.chave}.xml`; a.click();
    URL.revokeObjectURL(url);
  });
})();
