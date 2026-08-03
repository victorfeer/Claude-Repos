package tech.voke.nfe.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tech.voke.nfe.dto.NotaFiscalDTO;
import tech.voke.nfe.integration.SankhyaClient;
import tech.voke.nfe.service.NfeService;

import java.util.Map;

/**
 * API de consulta de NF-e pela chave de acesso.
 *   GET /api/v1/nfe/{chave}   → NotaFiscalDTO (JSON) ou 404.
 */
@RestController
@RequestMapping("/api/v1/nfe")
public class NfeController {

    private static final Logger log = LoggerFactory.getLogger(NfeController.class);
    private final NfeService service;

    public NfeController(NfeService service) {
        this.service = service;
    }

    @GetMapping("/{chave}")
    public ResponseEntity<?> consultar(@PathVariable String chave) {
        String limpa = chave == null ? "" : chave.replaceAll("\\D", "");
        if (limpa.length() != 44) {
            return ResponseEntity.badRequest().body(Map.of("erro", "A chave deve ter 44 dígitos."));
        }
        try {
            return service.consultarPorChave(limpa)
                    .<ResponseEntity<?>>map(ResponseEntity::ok)
                    .orElseGet(() -> ResponseEntity.status(404)
                            .body(Map.of("erro", "Nota não localizada no Sankhya para esta chave.")));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(503).body(Map.of("erro", e.getMessage()));
        } catch (SankhyaClient.SankhyaException e) {
            log.error("Erro Sankhya: {}", e.getMessage());
            return ResponseEntity.status(502).body(Map.of("erro", e.getMessage()));
        }
    }
}
