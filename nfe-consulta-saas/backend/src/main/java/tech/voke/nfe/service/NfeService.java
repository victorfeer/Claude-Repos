package tech.voke.nfe.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import tech.voke.nfe.dto.NotaFiscalDTO;
import tech.voke.nfe.integration.SankhyaClient;
import tech.voke.nfe.integration.SankhyaNfeGateway;

import java.util.Optional;

/**
 * Consulta a NF-e pela chave de acesso via API do Sankhya (OAuth 2.0).
 * Registra a consulta no log (auditoria mínima); o cache/histórico em banco
 * é uma evolução prevista na arquitetura.
 */
@Service
public class NfeService {

    private static final Logger log = LoggerFactory.getLogger(NfeService.class);

    private final SankhyaClient sankhya;
    private final SankhyaNfeGateway gateway;

    public NfeService(SankhyaClient sankhya, SankhyaNfeGateway gateway) {
        this.sankhya = sankhya;
        this.gateway = gateway;
    }

    public Optional<NotaFiscalDTO> consultarPorChave(String chave) {
        long inicio = System.currentTimeMillis();
        if (!sankhya.disponivel()) {
            log.warn("Sankhya não configurado (sankhya.client-id/secret/x-token ausentes) — consulta indisponível.");
            throw new IllegalStateException("Integração Sankhya não configurada no servidor.");
        }
        try {
            Optional<NotaFiscalDTO> nota = gateway.consultar(chave);
            log.info("Consulta NF-e chave={} resultado={} ({} ms)",
                    chave, nota.isPresent() ? "ENCONTRADA" : "NAO_ENCONTRADA", System.currentTimeMillis() - inicio);
            return nota;
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new SankhyaClient.SankhyaException("Falha ao consultar a NF-e: " + e.getMessage());
        }
    }
}
