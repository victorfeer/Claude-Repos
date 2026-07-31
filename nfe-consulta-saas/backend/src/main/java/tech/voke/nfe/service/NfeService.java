package tech.voke.nfe.service;

import org.springframework.stereotype.Service;
import tech.voke.nfe.dto.NotaFiscalDTO;

import java.util.Optional;

/**
 * Orquestra a consulta de NF-e aplicando a estratégia de fontes em cascata:
 *
 *   1) Cache/repositório próprio (tabela nota_fiscal)  — mais rápido.
 *   2) Sankhya (API REST DbExplorer ou consulta ao banco Oracle).
 *   3) (Opcional) SEFAZ — quando permitido e a nota não é do próprio emitente.
 *
 * Toda consulta é registrada em `consulta` e auditada em `log_auditoria`.
 */
@Service
public class NfeService {

    private final NotaCacheService cache;
    private final SankhyaNfeGateway sankhya;
    private final ConsultaAuditService auditoria;

    public NfeService(NotaCacheService cache,
                      SankhyaNfeGateway sankhya,
                      ConsultaAuditService auditoria) {
        this.cache = cache;
        this.sankhya = sankhya;
        this.auditoria = auditoria;
    }

    public Optional<NotaFiscalDTO> consultarPorChave(String chave) {
        long inicio = System.currentTimeMillis();

        // 1) Cache local
        Optional<NotaFiscalDTO> cached = cache.buscar(chave);
        if (cached.isPresent()) {
            auditoria.registrar(chave, "ENCONTRADA", "CACHE", ms(inicio));
            return cached;
        }

        // 2) Sankhya (API/DB) — resolve e persiste no cache para as próximas.
        Optional<NotaFiscalDTO> daSankhya = sankhya.consultar(chave);
        if (daSankhya.isPresent()) {
            cache.salvar(daSankhya.get());
            auditoria.registrar(chave, "ENCONTRADA", "SANKHYA", ms(inicio));
            return daSankhya;
        }

        // 3) Não encontrada (SEFAZ ficaria aqui, se habilitado)
        auditoria.registrar(chave, "NAO_ENCONTRADA", "SANKHYA", ms(inicio));
        return Optional.empty();
    }

    private int ms(long inicio) {
        return (int) (System.currentTimeMillis() - inicio);
    }
}
