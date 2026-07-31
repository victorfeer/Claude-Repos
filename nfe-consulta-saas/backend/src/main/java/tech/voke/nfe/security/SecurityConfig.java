package tech.voke.nfe.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Configuração de segurança da API.
 *
 *  - Stateless: autenticação por JWT (OAuth2 Resource Server).
 *  - Senhas com BCrypt (nunca em texto puro).
 *  - CORS restrito à origem do frontend.
 *  - Proteções: contra XSS/SQLi a defesa principal está na camada de dados
 *    (JPA/consultas parametrizadas) e na sanitização do frontend; aqui
 *    garantimos headers de segurança e ausência de sessão/cookie explorável.
 *
 * Perfis -> permissões (RBAC): ADMIN, OPERADOR, CONSULTA, AUDITOR.
 */
@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)   // API stateless com JWT (sem cookies de sessão)
            .cors(cors -> {})                        // origem definida em CorsConfig
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/v1/auth/**", "/actuator/health").permitAll()
                .requestMatchers("/api/v1/nfe/**").hasAnyRole("ADMIN", "OPERADOR", "CONSULTA")
                .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                .requestMatchers("/api/v1/auditoria/**").hasAnyRole("ADMIN", "AUDITOR")
                .anyRequest().authenticated()
            )
            .oauth2ResourceServer(oauth -> oauth.jwt(jwt -> {}))
            .headers(h -> h
                .contentSecurityPolicy(csp -> csp.policyDirectives("default-src 'self'"))
                .frameOptions(f -> f.deny())
            );
        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }
}
