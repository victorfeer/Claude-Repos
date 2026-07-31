/* ============================================================
   Leitura de arquivos locais de NF-e no navegador (sem backend).
   Aceita:
     - .zip  → descompacta (JSZip) e lê todos os .xml de NF-e dentro
     - .xml  → lê diretamente
   Retorna uma lista de objetos "nota" (via NfeXml.parse).
   ============================================================ */
window.NfeZip = (function () {
  "use strict";

  function lerTexto(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error("Falha ao ler o arquivo."));
      r.readAsText(file);
    });
  }

  function pareceNfe(xml) {
    return /infNFe/.test(xml);
  }

  /**
   * Processa um File e devolve { notas: [...], erros: [...] }.
   */
  async function processar(file) {
    const nome = (file.name || "").toLowerCase();
    const notas = [];
    const erros = [];

    if (nome.endsWith(".xml")) {
      const xml = await lerTexto(file);
      try { notas.push(NfeXml.parse(xml)); }
      catch (e) { erros.push(`${file.name}: ${e.message}`); }
      return { notas, erros };
    }

    if (nome.endsWith(".zip")) {
      if (typeof JSZip === "undefined") {
        throw new Error("Biblioteca de descompactação (JSZip) não carregada.");
      }
      const zip = await JSZip.loadAsync(file);
      const entradas = Object.values(zip.files)
        .filter(f => !f.dir && f.name.toLowerCase().endsWith(".xml"));

      if (!entradas.length) throw new Error("O .zip não contém arquivos .xml.");

      for (const entrada of entradas) {
        try {
          const xml = await entrada.async("string");
          if (!pareceNfe(xml)) { erros.push(`${entrada.name}: não é NF-e`); continue; }
          const nota = NfeXml.parse(xml);
          nota._arquivo = entrada.name;
          notas.push(nota);
        } catch (e) {
          erros.push(`${entrada.name}: ${e.message}`);
        }
      }
      return { notas, erros };
    }

    throw new Error("Formato não suportado. Envie um arquivo .zip ou .xml.");
  }

  return { processar };
})();
