package tech.voke.nfe.integration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Credenciais e endpoints da integração Sankhya (Gateway OAuth 2.0).
 * Preencha via variáveis de ambiente — nunca comite segredos.
 *
 *   sankhya.auth-url      = https://api.sankhya.com.br/authenticate
 *   sankhya.gateway-url   = https://api.sankhya.com.br/gateway/v1/mge/service.sbr
 *   sankhya.client-id     = <Área do Desenvolvedor>
 *   sankhya.client-secret = <Área do Desenvolvedor>
 *   sankhya.x-token       = <Sankhya Om → Configurações → Gateway>
 */
@ConfigurationProperties(prefix = "sankhya")
public record SankhyaProperties(
        String authUrl,
        String gatewayUrl,
        String clientId,
        String clientSecret,
        String xToken
) {
    public boolean configurado() {
        return clientId != null && !clientId.isBlank()
            && clientSecret != null && !clientSecret.isBlank()
            && xToken != null && !xToken.isBlank();
    }
}
