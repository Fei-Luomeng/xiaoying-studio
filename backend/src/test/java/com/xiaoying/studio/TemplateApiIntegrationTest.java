package com.xiaoying.studio;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class TemplateApiIntegrationTest {
    @Autowired
    private TestRestTemplate http;

    @Test
    void categoriesAndListsComeFromSeededDatabase() {
        var categories = http.getForEntity("/api/templates/categories", JsonNode.class);
        assertThat(categories.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(categories.getBody().toString()).contains("创意图片", "萌宠时刻", "生活记录");
        var templates = http.getForObject("/api/templates", JsonNode.class);
        assertThat(templates.size()).isGreaterThanOrEqualTo(6);
        assertThat(templates.get(0).get("id").asText()).isEqualTo("travel-postcard");
    }

    @Test
    void categoryFilterDoesNotReturnOtherCategories() {
        var templates = http.getForObject("/api/templates?category={category}", JsonNode.class, "萌宠时刻");
        assertThat(templates.size()).isEqualTo(2);
        templates.forEach(template -> assertThat(template.get("category").asText()).isEqualTo("萌宠时刻"));
    }

    @Test
    void unknownCategoryAndSqlLikeInputReturnEmptyLists() {
        for (String category : new String[] {"不存在", "' OR '1'='1"}) {
            var templates = http.getForEntity("/api/templates?category={category}", JsonNode.class, category);
            assertThat(templates.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(templates.getBody().isArray()).isTrue();
            assertThat(templates.getBody().isEmpty()).isTrue();
        }
    }

    @Test
    void detailExposesTypedUploadRequirements() {
        var template = http.getForObject("/api/templates/travel-postcard", JsonNode.class);
        assertThat(template.get("title").asText()).isEqualTo("旅行明信片");
        assertThat(template.get("description").asText()).contains("旅途照片");
        assertThat(template.get("requiredImageCount").asInt()).isEqualTo(2);
        assertThat(template.get("maxFileSizeBytes").asLong()).isEqualTo(5242880);
        assertThat(template.get("acceptedMimeTypes").isArray()).isTrue();
        assertThat(template.get("acceptedMimeTypes").toString()).contains("image/jpeg", "image/png");
        assertThat(template.has("acceptedMimeTypesJson")).isFalse();
    }

    @Test
    void missingTemplateReturnsReadable404() {
        var response = http.getForEntity("/api/templates/missing", JsonNode.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody().get("detail").asText()).contains("模板不存在");
    }

    @Test
    void oversizedCategoryReturns400() {
        var response = http.getForEntity("/api/templates?category={category}", JsonNode.class, "a".repeat(65));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void everySeededCoverIsServedLocally() {
        var templates = http.getForObject("/api/templates", JsonNode.class);
        templates.forEach(template -> {
            var cover = http.getForEntity(template.get("coverUrl").asText(), String.class);
            assertThat(cover.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(cover.getHeaders().getContentType().toString()).contains("image/svg+xml");
            assertThat(cover.getBody()).contains("<svg", "</svg>");
        });
    }
}
