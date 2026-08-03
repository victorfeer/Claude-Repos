/* Dados de demonstração — usados quando o backend não está configurado.
   Estrutura idêntica ao contrato retornado por GET /api/v1/nfe/{chave}. */
window.NFE_MOCK = {
  chave: "35240114200166000187550010000123451123456789",
  numero: "12345",
  serie: "1",
  emissao: "2024-01-15T10:32:00",
  natureza: "Venda de mercadoria adquirida de terceiros",
  status: "AUTORIZADA",            // AUTORIZADA | CANCELADA | DENEGADA
  protocolo: "135240001234567",
  dhProtocolo: "2024-01-15T10:33:12",
  emitente:     { nome: "Voke Tecnologia LTDA",       cnpj: "14.200.166/0001-87" },
  destinatario: { nome: "Cliente Exemplo Comercio SA", cnpj: "09.876.543/0001-21" },
  valorTotal: 4875.90,
  totalProdutos: 4500.00,
  totalImpostos: 375.90,
  produtos: [
    { item: 1, descricao: "Notebook Corporativo 14 i5 16GB", ncm: "8471.30.19", qtd: 3, unitario: 1200.00, total: 3600.00 },
    { item: 2, descricao: "Monitor LED 24 Full HD",          ncm: "8528.52.20", qtd: 3, unitario: 300.00,  total: 900.00 }
  ],
  impostos: [
    { nome: "ICMS",   base: 4500.00, valor: 540.00 },
    { nome: "IPI",    base: 4500.00, valor: 0.00 },
    { nome: "PIS",    base: 4500.00, valor: 74.25 },
    { nome: "COFINS", base: 4500.00, valor: 342.00 }
  ],
  xml: `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe>
    <infNFe Id="NFe35240114200166000187550010000123451123456789">
      <ide><cUF>35</cUF><nNF>12345</nNF><serie>1</serie><dhEmi>2024-01-15T10:32:00-03:00</dhEmi></ide>
      <emit><CNPJ>14200166000187</CNPJ><xNome>Voke Tecnologia LTDA</xNome></emit>
      <dest><CNPJ>09876543000121</CNPJ><xNome>Cliente Exemplo Comercio SA</xNome></dest>
      <total><ICMSTot><vNF>4875.90</vNF></ICMSTot></total>
    </infNFe>
  </NFe>
  <protNFe><infProt><nProt>135240001234567</nProt><dhRecbto>2024-01-15T10:33:12-03:00</dhRecbto>
    <cStat>100</cStat><xMotivo>Autorizado o uso da NF-e</xMotivo></infProt></protNFe>
</nfeProc>`
};
