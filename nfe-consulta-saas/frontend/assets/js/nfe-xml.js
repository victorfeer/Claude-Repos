/* ============================================================
   Parser de XML de NF-e (layout nfeProc / NFe 4.00) → objeto "nota"
   com a MESMA estrutura consumida por app.js / pdf.js.
   Funciona 100% no navegador (sem backend).
   ============================================================ */
window.NfeXml = (function () {
  "use strict";

  /** Primeiro elemento por tag (ignora prefixo de namespace). */
  function el(ctx, tag) {
    if (!ctx) return null;
    const nl = ctx.getElementsByTagName(tag);
    if (nl && nl.length) return nl[0];
    // fallback por localName (docs com namespace)
    const all = ctx.getElementsByTagName("*");
    for (const n of all) if (n.localName === tag) return n;
    return null;
  }

  /** Texto de uma tag (ou "" se ausente). */
  function txt(ctx, tag) {
    const e = el(ctx, tag);
    return e ? (e.textContent || "").trim() : "";
  }

  function num(ctx, tag) {
    const v = txt(ctx, tag).replace(",", ".");
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  }

  function fmtDoc(d) {
    d = (d || "").replace(/\D/g, "");
    if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
    if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
    return d || "—";
  }

  function statusDeCStat(cStat) {
    const c = parseInt(cStat, 10);
    if (c === 100 || c === 150) return "AUTORIZADA";
    if ([101, 135, 151, 155, 110].includes(c)) return "CANCELADA";
    if ([301, 302, 303].includes(c)) return "DENEGADA";
    return cStat ? "AUTORIZADA" : "—";
  }

  /**
   * Converte a string XML de uma NF-e em objeto "nota".
   * @param {string} xmlString
   * @returns {object} nota
   */
  function parse(xmlString) {
    const doc = new DOMParser().parseFromString(xmlString, "application/xml");
    if (doc.getElementsByTagName("parsererror").length) {
      throw new Error("XML inválido ou corrompido.");
    }

    const infNFe = el(doc, "infNFe");
    if (!infNFe) throw new Error("Não é um XML de NF-e (tag infNFe ausente).");

    // Chave: atributo Id="NFe<44>"
    const idAttr = infNFe.getAttribute("Id") || "";
    const chave = idAttr.replace(/\D/g, "").slice(-44);

    const ide = el(infNFe, "ide");
    const emit = el(infNFe, "emit");
    const dest = el(infNFe, "dest");
    const total = el(infNFe, "total");
    const icmsTot = el(total, "ICMSTot");

    // Emissão: dhEmi (4.00) ou dEmi (antigo)
    const emissao = txt(ide, "dhEmi") || txt(ide, "dEmi");

    // Protocolo (nfeProc → protNFe/infProt)
    const infProt = el(doc, "infProt");
    const protocolo = infProt ? txt(infProt, "nProt") : "";
    const dhProtocolo = infProt ? txt(infProt, "dhRecbto") : "";
    const cStat = infProt ? txt(infProt, "cStat") : "";

    // Produtos (det → prod)
    const dets = infNFe.getElementsByTagName("det");
    const produtos = [];
    for (let i = 0; i < dets.length; i++) {
      const prod = el(dets[i], "prod");
      if (!prod) continue;
      produtos.push({
        item: parseInt(dets[i].getAttribute("nItem") || (i + 1), 10),
        descricao: txt(prod, "xProd"),
        ncm: txt(prod, "NCM"),
        qtd: num(prod, "qCom"),
        unitario: num(prod, "vUnCom"),
        total: num(prod, "vProd")
      });
    }

    // Impostos (totais)
    const impostos = [
      { nome: "ICMS",   base: num(icmsTot, "vBC"),    valor: num(icmsTot, "vICMS") },
      { nome: "IPI",    base: num(icmsTot, "vProd"),  valor: num(icmsTot, "vIPI") },
      { nome: "PIS",    base: num(icmsTot, "vProd"),  valor: num(icmsTot, "vPIS") },
      { nome: "COFINS", base: num(icmsTot, "vProd"),  valor: num(icmsTot, "vCOFINS") }
    ];
    const totalImpostos = impostos.reduce((s, i) => s + i.valor, 0);

    return {
      chave,
      numero: txt(ide, "nNF"),
      serie: txt(ide, "serie"),
      emissao,
      natureza: txt(ide, "natOp"),
      status: statusDeCStat(cStat),
      protocolo: protocolo || "—",
      dhProtocolo,
      emitente:     { nome: txt(emit, "xNome"), cnpj: fmtDoc(txt(emit, "CNPJ") || txt(emit, "CPF")) },
      destinatario: { nome: txt(dest, "xNome"), cnpj: fmtDoc(txt(dest, "CNPJ") || txt(dest, "CPF")) },
      valorTotal:    num(icmsTot, "vNF"),
      totalProdutos: num(icmsTot, "vProd"),
      totalImpostos,
      produtos,
      impostos,
      xml: xmlString
    };
  }

  return { parse };
})();
