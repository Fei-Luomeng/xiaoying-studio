package com.xiaoying.studio;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.xiaoying.studio.auth.AuthService;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.zip.CRC32;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.util.LinkedMultiValueMap;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class IdentityAssetIntegrationTest {
    private static final Path STORAGE;
    static {
        try { STORAGE = Files.createTempDirectory("studio-upload-test-"); }
        catch (Exception exception) { throw new IllegalStateException(exception); }
    }

    @DynamicPropertySource
    static void storage(DynamicPropertyRegistry registry) {
        registry.add("studio.storage-root", () -> STORAGE.toString());
    }

    @Autowired private TestRestTemplate http;
    @Autowired private JdbcTemplate jdbc;
    private final List<String> sessionHashes = new ArrayList<>();
    private final List<String> assetIds = new ArrayList<>();

    @AfterEach
    void cleanUpOnlyTestRecords() throws Exception {
        for (String id : assetIds) {
            var names = jdbc.queryForList("SELECT stored_name FROM assets WHERE id = ?", String.class, id);
            jdbc.update("DELETE FROM assets WHERE id = ?", id);
            for (String name : names) Files.deleteIfExists(STORAGE.resolve("uploads").resolve(name));
        }
        for (String hash : sessionHashes) jdbc.update("DELETE FROM user_sessions WHERE token_hash = ?", hash);
    }

    @Test
    void anonymousUsersCannotReadPrivateData() {
        assertThat(http.getForEntity("/api/auth/me", JsonNode.class).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(http.getForEntity("/api/assets", JsonNode.class).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        var users = http.getForObject("/api/auth/demo-users", JsonNode.class);
        assertThat(users.toString()).contains("demo-chen", "小陈", "demo-lin", "小林");
    }

    @Test
    void mutationsRequireCustomHeaderAndValidParameters() {
        assertThat(http.postForEntity("/api/auth/session", Map.of("userId", "demo-chen"), JsonNode.class)
                .getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        var bad = http.postForEntity("/api/auth/session", new HttpEntity<>(Map.of("userId", ""), headers(null)), JsonNode.class);
        assertThat(bad.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void uploadRequiresSessionAndRejectsEmptyFiles() throws Exception {
        assertThat(upload(null, image("png"), "image/png", "test.png", "pet-portrait")
                .getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        String cookie = login("demo-chen", null);
        assertThat(upload(cookie, new byte[0], "image/png", "empty.png", "pet-portrait")
                .getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void sessionSurvivesQueriesAndSwitchInvalidatesOldToken() throws Exception {
        String first = login("demo-chen", null);
        var me = http.exchange("/api/auth/me", HttpMethod.GET, new HttpEntity<>(headers(first)), JsonNode.class);
        assertThat(me.getBody().get("id").asText()).isEqualTo("demo-chen");
        String second = login("demo-lin", first);
        assertThat(http.exchange("/api/auth/me", HttpMethod.GET, new HttpEntity<>(headers(first)), JsonNode.class)
                .getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        var logout = http.exchange("/api/auth/session", HttpMethod.DELETE, new HttpEntity<>(headers(second)), Void.class);
        assertThat(logout.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(logout.getHeaders().getFirst(HttpHeaders.SET_COOKIE)).contains("Max-Age=0");
        assertThat(http.exchange("/api/auth/me", HttpMethod.GET, new HttpEntity<>(headers(second)), JsonNode.class)
                .getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void expiredSessionsAreRejected() throws Exception {
        String cookie = login("demo-chen", null);
        jdbc.update("UPDATE user_sessions SET expires_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY) WHERE token_hash = ?", hash(cookie));
        assertThat(http.exchange("/api/auth/me", HttpMethod.GET, new HttpEntity<>(headers(cookie)), JsonNode.class)
                .getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void pngIsStoredAndServedToItsOwnerOnly() throws Exception {
        String owner = login("demo-chen", null), other = login("demo-lin", null);
        byte[] png = image("png");
        var response = upload(owner, png, "image/png", "旅行.png", "travel-postcard");
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        JsonNode asset = response.getBody();
        assertThat(asset.get("ownerId").asText()).isEqualTo("demo-chen");
        assertThat(asset.get("originalName").asText()).isEqualTo("旅行.png");
        assertThat(asset.get("width").asInt()).isEqualTo(8);
        assertThat(asset.get("height").asInt()).isEqualTo(6);
        assertThat(asset.get("mimeType").asText()).isEqualTo("image/png");
        String url = asset.get("url").asText();
        var file = http.exchange(url, HttpMethod.GET, new HttpEntity<>(headers(owner)), byte[].class);
        assertThat(file.getBody()).isEqualTo(png);
        assertThat(file.getHeaders().getCacheControl()).contains("no-store");
        assertThat(file.getHeaders().getFirst("X-Content-Type-Options")).isEqualTo("nosniff");
        assertThat(http.exchange(url, HttpMethod.GET, new HttpEntity<>(headers(other)), JsonNode.class)
                .getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(http.exchange("/api/assets/" + asset.get("id").asText(), HttpMethod.GET,
                new HttpEntity<>(headers(other)), JsonNode.class).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        var list = http.exchange("/api/assets", HttpMethod.GET, new HttpEntity<>(headers(owner)), JsonNode.class);
        assertThat(list.getBody().toString()).contains(asset.get("id").asText());
        var otherList = http.exchange("/api/assets", HttpMethod.GET, new HttpEntity<>(headers(other)), JsonNode.class);
        assertThat(otherList.getBody().toString()).doesNotContain(asset.get("id").asText());
    }

    @Test
    void jpegUploadAndServerOwnedFilenameWork() throws Exception {
        String cookie = login("demo-chen", null);
        var asset = upload(cookie, image("jpeg"), "image/jpeg", "../../portrait.jpg", "pet-portrait");
        assertThat(asset.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(asset.getBody().get("originalName").asText()).isEqualTo("portrait.jpg");
        assertThat(asset.getBody().get("mimeType").asText()).isEqualTo("image/jpeg");
        String stored = jdbc.queryForObject("SELECT stored_name FROM assets WHERE id = ?", String.class,
                asset.getBody().get("id").asText());
        assertThat(stored).matches("[a-f0-9-]{36}\\.jpg");
    }

    @Test
    void invalidBytesMimeMismatchAndUnsupportedFormatsAreRejected() throws Exception {
        String cookie = login("demo-chen", null);
        assertThat(upload(cookie, "not an image".getBytes(StandardCharsets.UTF_8), "image/png", "fake.png", "pet-portrait")
                .getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(upload(cookie, image("png"), "image/jpeg", "fake.jpg", "pet-portrait")
                .getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(upload(cookie, image("png"), "text/plain", "file.txt", "pet-portrait")
                .getStatusCode()).isEqualTo(HttpStatus.UNSUPPORTED_MEDIA_TYPE);
        assertThat(upload(cookie, image("png"), "image/png", "file.png", "missing")
                .getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void oversizedAndDecompressionBombInputsAreRejectedBeforeDecoding() throws Exception {
        String cookie = login("demo-chen", null);
        assertThat(upload(cookie, new byte[5 * 1024 * 1024 + 1], "image/png", "large.png", "pet-portrait")
                .getStatusCode()).isEqualTo(HttpStatus.PAYLOAD_TOO_LARGE);
        byte[] huge = image("png");
        ByteBuffer.wrap(huge).putInt(16, 60000).putInt(20, 60000);
        CRC32 crc = new CRC32(); crc.update(huge, 12, 17);
        ByteBuffer.wrap(huge).putInt(29, (int) crc.getValue());
        var rejected = upload(cookie, huge, "image/png", "huge.png", "pet-portrait");
        assertThat(rejected.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(rejected.getBody().get("detail").asText()).contains("2000 万像素");
    }

    private HttpHeaders headers(String cookie) {
        var headers = new HttpHeaders();
        headers.set("X-Studio-Request", "1");
        if (cookie != null) headers.set(HttpHeaders.COOKIE, cookie);
        return headers;
    }

    private String login(String id, String previousCookie) throws Exception {
        var response = http.postForEntity("/api/auth/session",
                new HttpEntity<>(Map.of("userId", id), headers(previousCookie)), JsonNode.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        String setCookie = response.getHeaders().getFirst(HttpHeaders.SET_COOKIE);
        assertThat(setCookie).contains("HttpOnly", "SameSite=Lax", "Path=/api");
        String cookie = setCookie.split(";", 2)[0];
        assertThat(cookie).startsWith(AuthService.COOKIE_NAME + "=");
        sessionHashes.add(hash(cookie));
        return cookie;
    }

    private String hash(String cookie) throws Exception {
        String token = cookie.substring(cookie.indexOf('=') + 1);
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
    }

    private ResponseEntity<JsonNode> upload(String cookie, byte[] bytes, String mime, String name, String templateId) {
        var partHeaders = new HttpHeaders(); partHeaders.setContentType(MediaType.parseMediaType(mime));
        var resource = new ByteArrayResource(bytes) { @Override public String getFilename() { return name; } };
        var form = new LinkedMultiValueMap<String, Object>();
        form.add("file", new HttpEntity<>(resource, partHeaders));
        form.add("templateId", templateId);
        form.add("userId", "demo-lin"); // Must be ignored: ownership comes from the cookie.
        var requestHeaders = headers(cookie); requestHeaders.setContentType(MediaType.MULTIPART_FORM_DATA);
        var response = http.postForEntity("/api/assets", new HttpEntity<>(form, requestHeaders), JsonNode.class);
        if (response.getStatusCode().is2xxSuccessful()) assetIds.add(response.getBody().get("id").asText());
        return response;
    }

    private byte[] image(String format) throws Exception {
        var image = new BufferedImage(8, 6, BufferedImage.TYPE_INT_RGB);
        image.setRGB(1, 1, 0x64a8c7);
        var out = new ByteArrayOutputStream();
        assertThat(ImageIO.write(image, format, out)).isTrue();
        image.flush();
        return out.toByteArray();
    }
}
