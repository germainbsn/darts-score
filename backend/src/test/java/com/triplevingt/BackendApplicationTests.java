package com.triplevingt;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

// Needs the "local" profile for a datasource (the Postgres started via
// docker-compose.yml at the repo root) — this is a real smoke test that the
// whole context (JPA, Flyway, controllers) wires together correctly.
@SpringBootTest
@ActiveProfiles("local")
class BackendApplicationTests {

	@Test
	void contextLoads() {
	}

}
