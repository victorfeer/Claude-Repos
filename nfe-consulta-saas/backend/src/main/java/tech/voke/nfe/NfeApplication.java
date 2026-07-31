package tech.voke.nfe;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/** Ponto de entrada da API Consulta NF-e SaaS. */
@SpringBootApplication
public class NfeApplication {
    public static void main(String[] args) {
        SpringApplication.run(NfeApplication.class, args);
    }
}
