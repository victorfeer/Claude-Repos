package tech.voke.nfe.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tech.voke.nfe.dto.NotaFiscalDTO;
import tech.voke.nfe.service.NfeService;

/**
 * API REST de consulta de NF-e.
 * Segurança: exige JWT válido (ver SecurityConfig) e perfil com permissão
 * de consulta. O tenant (empresa) é derivado do token, nunca do path.
 */
@RestController
@RequestMapping("/api/v1/nfe")
public class NfeController {

    private final NfeService service;

    public NfeController(NfeService service) {
        this.service = service;
    }

    /**
     * Consulta uma NF-e pela chave de acesso (44 dígitos).
     * Estratégia da fonte de dados é resolvida no serviço:
     *   cache local -> Sankhya (API/DB) -> (opcional) SEFAZ.
     */
    @GetMapping("/{chave}")
    public ResponseEntity<NotaFiscalDTO> consultar(@PathVariable String chave) {
        String limpa = chave == null ? "" : chave.replaceAll("\\D", "");
        if (limpa.length() != 44) {
            return ResponseEntity.badRequest().build();
        }
        return service.consultarPorChave(limpa)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
