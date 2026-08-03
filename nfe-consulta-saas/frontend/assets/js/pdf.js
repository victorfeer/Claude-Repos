/* ============================================================
   Geração de PDF client-side com jsPDF + AutoTable + QR Code.
   Layout: cabeçalho Voke, dados da NF-e, produtos, totais,
   QR Code da chave, rodapé com data de geração.
   ============================================================ */
const NfePdf = {
  _fmtMoeda(v) {
    return (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  },
  _fmtData(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return isNaN(d) ? iso : d.toLocaleString("pt-BR");
  },

  /** Gera o QR Code da chave e retorna um dataURL PNG. */
  _gerarQrDataUrl(texto) {
    const holder = document.createElement("div");
    // qrcodejs renderiza em um elemento; extraímos o canvas/img gerado
    new QRCode(holder, { text: texto, width: 120, height: 120, correctLevel: QRCode.CorrectLevel.M });
    const canvas = holder.querySelector("canvas");
    if (canvas) return canvas.toDataURL("image/png");
    const img = holder.querySelector("img");
    return img ? img.src : null;
  },

  gerar(nota) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const navy = [27, 61, 109];
    const pink = [242, 145, 214];
    const pageW = doc.internal.pageSize.getWidth();
    let y = 14;

    // ---- Cabeçalho ----
    doc.setFillColor(...navy);
    doc.rect(0, 0, pageW, 26, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold").setFontSize(20);
    doc.text("voke", 14, 16);
    doc.setFont("helvetica", "normal").setFontSize(11);
    doc.text("Consulta NF-e", 40, 16);
    doc.setFontSize(9);
    doc.text("Documento gerado eletronicamente", pageW - 14, 12, { align: "right" });
    doc.text(this._fmtData(new Date().toISOString()), pageW - 14, 18, { align: "right" });
    doc.setDrawColor(...pink).setLineWidth(1);
    doc.line(0, 26, pageW, 26);
    y = 36;

    // ---- Título + status ----
    doc.setTextColor(...navy).setFont("helvetica", "bold").setFontSize(14);
    doc.text(`NF-e nº ${nota.numero}  ·  Série ${nota.serie}`, 14, y);
    doc.setFontSize(9).setFont("helvetica", "normal").setTextColor(90, 90, 90);
    doc.text(`Status: ${nota.status}`, pageW - 14, y, { align: "right" });
    y += 6;
    doc.setFontSize(8).text(`Chave de acesso: ${nota.chave}`, 14, y);
    y += 8;

    // ---- QR Code (canto direito) ----
    const qr = this._gerarQrDataUrl(nota.chave);
    if (qr) doc.addImage(qr, "PNG", pageW - 40, y - 2, 26, 26);

    // ---- Emitente / Destinatário / dados ----
    const linha = (rot, val) => {
      doc.setFont("helvetica", "bold").setTextColor(...navy).setFontSize(8).text(rot, 14, y);
      doc.setFont("helvetica", "normal").setTextColor(40, 40, 40).setFontSize(9).text(String(val || "—"), 14, y + 4);
      y += 11;
    };
    linha("EMITENTE", `${nota.emitente.nome}   —   CNPJ ${nota.emitente.cnpj}`);
    linha("DESTINATÁRIO", `${nota.destinatario.nome}   —   CNPJ ${nota.destinatario.cnpj}`);
    linha("EMISSÃO", this._fmtData(nota.emissao));
    linha("PROTOCOLO DE AUTORIZAÇÃO", `${nota.protocolo}   (${this._fmtData(nota.dhProtocolo)})`);

    // ---- Tabela de produtos ----
    doc.autoTable({
      startY: y + 2,
      head: [["#", "Descrição", "NCM", "Qtd", "Vlr. Unit.", "Vlr. Total"]],
      body: nota.produtos.map(p => [
        p.item, p.descricao, p.ncm, p.qtd,
        this._fmtMoeda(p.unitario), this._fmtMoeda(p.total)
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: navy, textColor: 255 },
      columnStyles: { 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
      margin: { left: 14, right: 14 }
    });
    y = doc.lastAutoTable.finalY + 6;

    // ---- Totais ----
    doc.setFontSize(9).setTextColor(40, 40, 40);
    const totRot = (rot, val, bold) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.text(rot, pageW - 70, y);
      doc.text(this._fmtMoeda(val), pageW - 14, y, { align: "right" });
      y += 6;
    };
    totRot("Total produtos", nota.totalProdutos);
    totRot("Total impostos", nota.totalImpostos);
    doc.setDrawColor(...navy).line(pageW - 70, y - 3, pageW - 14, y - 3);
    doc.setTextColor(...navy);
    totRot("TOTAL DA NF-e", nota.valorTotal, true);

    // ---- Rodapé ----
    const h = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...pink).setLineWidth(0.8).line(14, h - 16, pageW - 14, h - 16);
    doc.setTextColor(90, 90, 90).setFont("helvetica", "normal").setFontSize(7.5);
    doc.text("voke · Consulta NF-e SaaS — Para que pessoas impulsionem o futuro com a tecnologia · voke.tech",
      pageW / 2, h - 11, { align: "center" });
    doc.text(`Emitido em ${this._fmtData(new Date().toISOString())} · Documento sem valor fiscal (cópia de consulta)`,
      pageW / 2, h - 7, { align: "center" });

    doc.save(`NFe_${nota.numero}_${nota.chave}.pdf`);
  }
};

window.NfePdf = NfePdf;
