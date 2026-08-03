package tech.voke.nfe.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Contrato de resposta da consulta de NF-e (JSON).
 * Espelha exatamente o objeto consumido pelo frontend (api.js).
 */
public record NotaFiscalDTO(
        String chave,
        String numero,
        String serie,
        String emissao,          // ISO-8601
        String natureza,
        String status,           // AUTORIZADA | CANCELADA | DENEGADA
        String protocolo,
        String dhProtocolo,      // ISO-8601
        Parte emitente,
        Parte destinatario,
        BigDecimal valorTotal,
        BigDecimal totalProdutos,
        BigDecimal totalImpostos,
        List<Produto> produtos,
        List<Imposto> impostos,
        String xml
) {
    public record Parte(String nome, String cnpj) {}

    public record Produto(int item, String descricao, String ncm,
                          BigDecimal qtd, BigDecimal unitario, BigDecimal total) {}

    public record Imposto(String nome, BigDecimal base, BigDecimal valor) {}
}
