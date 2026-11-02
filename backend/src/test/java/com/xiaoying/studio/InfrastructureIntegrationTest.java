package com.xiaoying.studio;

import static org.assertj.core.api.Assertions.assertThat;

import com.xiaoying.studio.system.SystemController.SystemStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;

/** Uses the real MySQL initialized by Compose or the CI MySQL service. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class InfrastructureIntegrationTest {
    @Autowired
    private TestRestTemplate http;

    @Test
    void statusReadsSeededTemplatesThroughMyBatis() {
        var response = http.getForEntity("/api/system/status", SystemStatus.class);

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().status()).isEqualTo("UP");
        assertThat(response.getBody().templateCount()).isGreaterThanOrEqualTo(6);
    }

    @Test
    void healthIncludesDatabaseConnectivity() {
        var response = http.getForEntity("/actuator/health", String.class);

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(response.getBody()).contains("\"status\":\"UP\"");
    }
}
