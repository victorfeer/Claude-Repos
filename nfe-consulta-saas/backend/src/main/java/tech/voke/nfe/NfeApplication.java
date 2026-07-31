package tech.voke.nfe;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

/** Ponto de entrada da API Consulta NF-e (single-tenant · integração Sankhya OAuth 2.0). */
@SpringBootApplication
@ConfigurationPropertiesScan
public class NfeApplication {
    public static void main(String[] args) {
        SpringApplication.run(NfeApplication.class, args);
    }
}
