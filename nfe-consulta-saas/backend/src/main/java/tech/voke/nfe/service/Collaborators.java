package tech.voke.nfe.service;

import tech.voke.nfe.dto.NotaFiscalDTO;

import java.util.Optional;

/**
 * Interfaces dos colaboradores do NfeService.
 * As implementações concretas (JPA, Sankhya, auditoria) ficam em suas
 * próprias classes; aqui declaramos apenas os contratos para manter o
 * serviço testável (injeção de dependência / mocks).
 */
final class Collaborators { private Collaborators() {} }

/** Cache/repositório próprio das notas (tabela nota_fiscal + nota_xml). */
interface NotaCacheService {
    Optional<NotaFiscalDTO> buscar(String chave);
    void salvar(NotaFiscalDTO nota);
}

/** Gateway que resolve a nota via API/DB do Sankhya e normaliza para o DTO. */
interface SankhyaNfeGateway {
    Optional<NotaFiscalDTO> consultar(String chave);
}

/** Registra a consulta (tabela consulta) e a trilha de auditoria (log_auditoria). */
interface ConsultaAuditService {
    void registrar(String chave, String resultado, String fonte, int duracaoMs);
}
