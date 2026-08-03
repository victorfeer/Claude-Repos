package tech.voke.nfe.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Cliente do Gateway Sankhya (OAuth 2.0 Client Credentials + X-Token).
 *
 * Fluxo:
 *   1) POST {authUrl}  → obtém access_token (JWT), reaproveitado até expirar.
 *   2) POST {gatewayUrl}?serviceName=DbExplorerSP.executeQuery  → roda SQL e
 *      devolve as linhas (fieldsMetadata + rows).
 *
 * Observação: o path/serviço e o formato da resposta do Gateway podem variar
 * conforme a versão do ambiente. A extração está centralizada em executeQuery()
 * para facilitar ajuste contra o seu Sankhya.
 */
@Component
public class SankhyaClient {

    private static final Logger log = LoggerFactory.getLogger(SankhyaClient.class);

    private final SankhyaProperties props;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final ObjectMapper mapper = new ObjectMapper();

    private volatile String token;
    private volatile Instant tokenExpira = Instant.EPOCH;

    public SankhyaClient(SankhyaProperties props) {
        this.props = props;
    }

    /** Retorna um access_token válido, autenticando/renovando quando necessário. */
    private synchronized String token() throws Exception {
        if (token != null && Instant.now().isBefore(tokenExpira)) return token;

        String body = "client_id=" + enc(props.clientId())
                + "&client_secret=" + enc(props.clientSecret())
                + "&grant_type=client_credentials";

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(props.authUrl()))
                .timeout(Duration.ofSeconds(15))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .header("X-Token", props.xToken())
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() != 200) {
            throw new SankhyaException("Falha na autenticação Sankhya (HTTP " + resp.statusCode() + "): " + resp.body());
        }
        JsonNode json = mapper.readTree(resp.body());
        token = json.get("access_token").asText();
        long expiresIn = json.has("expires_in") ? json.get("expires_in").asLong() : 300;
        tokenExpira = Instant.now().plusSeconds(Math.max(60, expiresIn - 60)); // margem de 60s
        log.debug("Token Sankhya renovado, expira em {}", tokenExpira);
        return token;
    }

    /**
     * Executa uma consulta SQL no Sankhya e devolve as linhas como lista de mapas
     * (coluna → valor), preservando a ordem das colunas do SELECT.
     */
    public List<Map<String, String>> executeQuery(String sql) throws Exception {
        ObjectNode reqBody = mapper.createObjectNode();
        reqBody.put("serviceName", "DbExplorerSP.executeQuery");
        reqBody.putObject("requestBody").put("sql", sql);

        String url = props.gatewayUrl() + "?serviceName=DbExplorerSP.executeQuery&outputType=json";
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(25))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + token())
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(reqBody)))
                .build();

        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() == 401) {                 // token expirado no meio do caminho
            token = null;
            req = HttpRequest.newBuilder(req.uri())
                    .timeout(Duration.ofSeconds(25))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + token())
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(reqBody)))
                    .build();
            resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        }
        if (resp.statusCode() != 200) {
            throw new SankhyaException("Erro na consulta Sankhya (HTTP " + resp.statusCode() + "): " + resp.body());
        }
        return parseRows(mapper.readTree(resp.body()));
    }

    /** Converte a resposta do DbExplorer (fieldsMetadata + rows) em lista de mapas. */
    private List<Map<String, String>> parseRows(JsonNode root) {
        JsonNode rb = root.path("responseBody");
        JsonNode meta = rb.path("fieldsMetadata");
        JsonNode rows = rb.path("rows");

        List<String> cols = new ArrayList<>();
        if (meta.isArray()) for (JsonNode m : meta) cols.add(m.path("name").asText());

        List<Map<String, String>> out = new ArrayList<>();
        if (rows.isArray()) {
            for (JsonNode row : rows) {
                Map<String, String> m = new LinkedHashMap<>();
                for (int i = 0; i < cols.size() && i < row.size(); i++) {
                    JsonNode v = row.get(i);
                    m.put(cols.get(i), v == null || v.isNull() ? null : v.asText());
                }
                out.add(m);
            }
        }
        return out;
    }

    public boolean disponivel() {
        return props.configurado();
    }

    private static String enc(String v) {
        return URLEncoder.encode(v, StandardCharsets.UTF_8);
    }

    /** Exceção da integração Sankhya. */
    public static class SankhyaException extends RuntimeException {
        public SankhyaException(String msg) { super(msg); }
    }
}
