package tech.voke.nfe.integration;

import java.time.Instant;

/**
 * Tipos de apoio da integração Sankhya (credenciais, token e exceções).
 * Mantidos juntos por serem pequenos e coesos.
 */
public final class SankhyaSupport { private SankhyaSupport() {} }

/** Credenciais por tenant (empresa) — decifradas em memória a partir do banco. */
record SankhyaCredentials(String baseUrl, String clientId, String clientSecret, String xToken) {}

/** Token JWT com controle de expiração para reaproveitamento. */
record SankhyaToken(String accessToken, Instant expiraEm) {
    boolean expirado() { return Instant.now().isAfter(expiraEm); }
}

class SankhyaException extends RuntimeException {
    SankhyaException(String msg) { super(msg); }
}

class SankhyaUnauthorizedException extends SankhyaException {
    SankhyaUnauthorizedException() { super("Token Sankhya expirado ou inválido"); }
}
