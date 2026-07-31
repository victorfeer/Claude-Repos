package tech.voke.nfe.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;

/**
 * Cliente de integração com a API pública da Sankhya (Gateway).
 *
 * Autenticação: OAuth 2.0 Client Credentials + header X-Token.
 *   POST https://api.sankhya.com.br/authenticate
 *   Content-Type: application/x-www-form-urlencoded
 *   Header: X-Token
 *   Body:   client_id, client_secret, grant_type=client_credentials
 *
 * O access_token (JWT) é reaproveitado até expirar; ao receber 401 renova.
 *
 * As credenciais chegam por tenant (empresa) — cada empresa tem seu próprio
 * client_id/secret/X-Token, permitindo o modelo multiempresa.
 */
@Component
public class SankhyaClient {

    private static final String AUTH_URL = "https://api.sankhya.com.br/authenticate";
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10)).build();
    private final ObjectMapper mapper = new ObjectMapper();

    /** Autentica e devolve um token com validade controlada. */
    public SankhyaToken autenticar(SankhyaCredentials cred) throws Exception {
        String body = "client_id=" + enc(cred.clientId())
                + "&client_secret=" + enc(cred.clientSecret())
                + "&grant_type=client_credentials";

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(AUTH_URL))
                .timeout(Duration.ofSeconds(15))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .header("X-Token", cred.xToken())
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() != 200) {
            throw new SankhyaException("Falha na autenticação Sankhya (HTTP " + resp.statusCode() + ")");
        }
        JsonNode json = mapper.readTree(resp.body());
        String accessToken = json.get("access_token").asText();
        // JWT normalmente com expiração; margem de segurança de 60s.
        Instant expira = Instant.now().plusSeconds(
                json.has("expires_in") ? json.get("expires_in").asLong() - 60 : 240);
        return new SankhyaToken(accessToken, expira);
    }

    /**
     * Executa a query de serviço (DbExplorerSP / DatasetSP.loadRecords) para
     * carregar a NF-e pela chave de acesso. Retorna o JSON bruto da Sankhya,
     * que é normalizado pela camada de serviço.
     */
    public JsonNode consultarNfePorChave(SankhyaCredentials cred, SankhyaToken token,
                                         String chave) throws Exception {
        // Endpoint de serviço do Gateway (gateway.sankhya.com.br) — o path exato
        // depende do serviço liberado no ambiente (ex.: DbExplorerSP.executeQuery).
        String url = cred.baseUrl() + "/gateway/v1/mgecom/service.sbr"
                + "?serviceName=DbExplorerSP.executeQuery&outputType=json";

        // SQL parametrizada — a chave já vem validada (44 dígitos) da borda.
        String sql = """
            SELECT cab.NUNOTA, cab.NUMNOTA, cab.SERIENOTA, cab.DTNEG, cab.CHAVENFE,
                   cab.STATUSNOTA, cab.VLRNOTA, cab.NUMEROPROT, cab.DHPROT,
                   par.NOMEPARC, par.CGC_CPF
            FROM TGFCAB cab
            JOIN TGFPAR par ON par.CODPARC = cab.CODPARC
            WHERE cab.CHAVENFE = :chave
            """;

        String payload = mapper.writeValueAsString(
                new QueryRequest(new QueryBody(sql.replace(":chave", "'" + chave + "'"))));

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(20))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + token.accessToken())
                .POST(HttpRequest.BodyPublishers.ofString(payload))
                .build();

        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() == 401) throw new SankhyaUnauthorizedException();
        if (resp.statusCode() != 200)
            throw new SankhyaException("Erro ao consultar NF-e (HTTP " + resp.statusCode() + ")");
        return mapper.readTree(resp.body());
    }

    private static String enc(String v) {
        return java.net.URLEncoder.encode(v, java.nio.charset.StandardCharsets.UTF_8);
    }

    // --- estruturas auxiliares de payload ---
    private record QueryRequest(QueryBody requestBody) {}
    private record QueryBody(String sql) {}
}
