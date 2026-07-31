package tech.voke.nfe.integration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import tech.voke.nfe.dto.NotaFiscalDTO;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Resolve a NF-e pela chave de acesso consultando o Sankhya (TGFCAB/TGFITE/…)
 * e normaliza para o {@link NotaFiscalDTO} consumido pela tela.
 *
 * ⚠️ As SQLs usam os campos padrão do dicionário Sankhya. Dependendo da versão
 * do seu ambiente, alguns nomes podem variar (ex.: onde fica o status de
 * autorização da NF-e e o XML autorizado). Os pontos sensíveis estão comentados.
 */
@Component
public class SankhyaNfeGateway {

    private static final Logger log = LoggerFactory.getLogger(SankhyaNfeGateway.class);
    private static final DateTimeFormatter BR = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");
    private static final DateTimeFormatter BR_D = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final SankhyaClient sankhya;

    public SankhyaNfeGateway(SankhyaClient sankhya) {
        this.sankhya = sankhya;
    }

    public Optional<NotaFiscalDTO> consultar(String chave) throws Exception {
        // 1) Cabeçalho + parceiro + empresa (uma linha)
        String sqlCab = """
            SELECT cab.NUNOTA, cab.NUMNOTA, cab.SERIENOTA,
                   TO_CHAR(cab.DTNEG,'dd/MM/yyyy') AS DTNEG,
                   cab.STATUSNOTA, cab.TIPMOV, cab.VLRNOTA,
                   cab.NUMEROPROT,
                   TO_CHAR(cab.DHPROT,'dd/MM/yyyy HH24:MI:SS') AS DHPROT,
                   (SELECT t.DESCROPER FROM TGFTOP t
                      WHERE t.CODTIPOPER = cab.CODTIPOPER
                        AND t.DHALTER = (SELECT MAX(t2.DHALTER) FROM TGFTOP t2 WHERE t2.CODTIPOPER = cab.CODTIPOPER)
                   ) AS NATUREZA,
                   par.NOMEPARC AS PARC_NOME, par.CGC_CPF AS PARC_DOC,
                   pemp.RAZAOSOCIAL AS EMP_NOME, pemp.CGC_CPF AS EMP_DOC
            FROM TGFCAB cab
            JOIN TGFPAR par  ON par.CODPARC = cab.CODPARC
            JOIN TSIEMP emp  ON emp.CODEMP  = cab.CODEMP
            JOIN TGFPAR pemp ON pemp.CODPARC = emp.CODPARC
            WHERE cab.CHAVENFE = '%s'
            """.formatted(chave);

        List<Map<String, String>> cabRows = sankhya.executeQuery(sqlCab);
        if (cabRows.isEmpty()) return Optional.empty();
        Map<String, String> c = cabRows.get(0);
        String nunota = c.get("NUNOTA");

        // 2) Itens
        String sqlIte = """
            SELECT ite.SEQUENCIA, pro.DESCRPROD, pro.NCM,
                   ite.QTDNEG, ite.VLRUNIT, ite.VLRTOT,
                   NVL(ite.VLRICMS,0) AS VLRICMS, NVL(ite.VLRIPI,0) AS VLRIPI,
                   NVL(ite.BASEICMS,0) AS BASEICMS
            FROM TGFITE ite
            JOIN TGFPRO pro ON pro.CODPROD = ite.CODPROD
            WHERE ite.NUNOTA = %s
            ORDER BY ite.SEQUENCIA
            """.formatted(nunota);

        List<Map<String, String>> iteRows = sankhya.executeQuery(sqlIte);

        List<NotaFiscalDTO.Produto> produtos = new ArrayList<>();
        BigDecimal totProd = BigDecimal.ZERO, totIcms = BigDecimal.ZERO, totIpi = BigDecimal.ZERO, baseIcms = BigDecimal.ZERO;
        int i = 1;
        for (Map<String, String> it : iteRows) {
            BigDecimal vtot = dec(it.get("VLRTOT"));
            produtos.add(new NotaFiscalDTO.Produto(
                    i++, it.get("DESCRPROD"), it.get("NCM"),
                    dec(it.get("QTDNEG")), dec(it.get("VLRUNIT")), vtot));
            totProd = totProd.add(vtot);
            totIcms = totIcms.add(dec(it.get("VLRICMS")));
            totIpi = totIpi.add(dec(it.get("VLRIPI")));
            baseIcms = baseIcms.add(dec(it.get("BASEICMS")));
        }
        List<NotaFiscalDTO.Imposto> impostos = List.of(
                new NotaFiscalDTO.Imposto("ICMS", baseIcms, totIcms),
                new NotaFiscalDTO.Imposto("IPI", totProd, totIpi)
                // PIS/COFINS: adicionar aqui conforme os campos disponíveis no seu TGFITE.
        );
        BigDecimal totImpostos = totIcms.add(totIpi);

        // 3) Direção (emitente/destinatário) pelo tipo de movimento
        String tipmov = c.getOrDefault("TIPMOV", "");
        boolean entrada = tipmov.equals("C") || tipmov.equals("O"); // compra/entrada → empresa é destinatária
        NotaFiscalDTO.Parte empresa  = new NotaFiscalDTO.Parte(c.get("EMP_NOME"),  fmtDoc(c.get("EMP_DOC")));
        NotaFiscalDTO.Parte parceiro = new NotaFiscalDTO.Parte(c.get("PARC_NOME"), fmtDoc(c.get("PARC_DOC")));
        NotaFiscalDTO.Parte emit = entrada ? parceiro : empresa;
        NotaFiscalDTO.Parte dest = entrada ? empresa : parceiro;

        NotaFiscalDTO nota = new NotaFiscalDTO(
                chave,
                c.get("NUMNOTA"),
                c.get("SERIENOTA"),
                iso(c.get("DTNEG")),
                c.get("NATUREZA"),
                status(c.get("STATUSNOTA")),
                nvl(c.get("NUMEROPROT")),
                iso(c.get("DHPROT")),
                emit, dest,
                dec(c.get("VLRNOTA")),
                totProd,
                totImpostos,
                produtos,
                impostos,
                // XML autorizado: não vem por SQL simples. Recuperar via a fonte de XML
                // do seu ambiente (Monitor NF-e / repositório) e preencher aqui.
                null
        );
        log.debug("NF-e {} resolvida via Sankhya (NUNOTA {})", chave, nunota);
        return Optional.of(nota);
    }

    // ---- helpers ----
    private static BigDecimal dec(String v) {
        if (v == null || v.isBlank()) return BigDecimal.ZERO;
        String s = v.trim();
        if (s.contains(",")) {                 // formato pt-BR: 1.234,56
            s = s.replace(".", "").replace(",", ".");
        }
        try { return new BigDecimal(s); }
        catch (NumberFormatException e) { return BigDecimal.ZERO; }
    }

    private static String status(String statusNota) {
        // STATUSNOTA 'L' = Liberada (nota efetivada). O status de autorização da NF-e
        // pode estar em outro campo dependendo da versão (ex.: STATUSNFE). Ajuste se necessário.
        if (statusNota == null) return "PENDENTE";
        return switch (statusNota) {
            case "L" -> "AUTORIZADA";
            default -> "PENDENTE";
        };
    }

    private static String nvl(String v) { return v == null || v.isBlank() ? "—" : v; }

    private static String iso(String br) {
        if (br == null || br.isBlank()) return null;
        try { return LocalDateTime.parse(br, BR).toString(); }
        catch (Exception e) {
            try { return java.time.LocalDate.parse(br, BR_D).atStartOfDay().toString(); }
            catch (Exception ex) { return br; }
        }
    }

    private static String fmtDoc(String d) {
        if (d == null) return "—";
        String s = d.replaceAll("\\D", "");
        if (s.length() == 14) return s.replaceFirst("(\\d{2})(\\d{3})(\\d{3})(\\d{4})(\\d{2})", "$1.$2.$3/$4-$5");
        if (s.length() == 11) return s.replaceFirst("(\\d{3})(\\d{3})(\\d{3})(\\d{2})", "$1.$2.$3-$4");
        return d;
    }
}
