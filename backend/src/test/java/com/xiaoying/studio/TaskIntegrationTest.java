package com.xiaoying.studio;

import static org.assertj.core.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.xiaoying.studio.asset.AssetService;
import com.xiaoying.studio.task.*;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.util.LinkedMultiValueMap;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT)
class TaskIntegrationTest {
    static final Path STORAGE;
    static { try { STORAGE=Files.createTempDirectory("studio-task-test-"); } catch(Exception e) { throw new IllegalStateException(e); } }
    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) { registry.add("studio.storage-root",()->STORAGE.toString()); }
    @Autowired TestRestTemplate http;
    @Autowired JdbcTemplate jdbc;
    @Autowired TaskWorker worker;
    @Autowired TaskMapper mapper;
    @Autowired TaskStore store;
    @Autowired AssetService assets;
    List<String> tasks=new ArrayList<>(), inputs=new ArrayList<>(), hashes=new ArrayList<>();
    String owner;
    @BeforeEach void login() throws Exception { owner=loginAs("demo-chen"); }
    @AfterEach void cleanup() throws Exception {
        for(String id:tasks) {
            for(String name:jdbc.queryForList("SELECT result_name FROM tasks WHERE id=? AND result_name IS NOT NULL",String.class,id)) Files.deleteIfExists(STORAGE.resolve("results").resolve(name));
            jdbc.update("DELETE FROM task_steps WHERE task_id=?",id);
            jdbc.update("DELETE FROM task_assets WHERE task_id=?",id);
            jdbc.update("DELETE FROM tasks WHERE id=?",id);
        }
        for(String id:inputs) {
            for(String name:jdbc.queryForList("SELECT stored_name FROM assets WHERE id=?",String.class,id)) Files.deleteIfExists(STORAGE.resolve("uploads").resolve(name));
            jdbc.update("DELETE FROM assets WHERE id=?",id);
        }
        for(String hash:hashes) jdbc.update("DELETE FROM user_sessions WHERE token_hash=?",hash);
    }
    @Test void acceptanceIsQueuedAndQueriesNeverAdvanceIt() {
        String input=upload(owner,"pet-portrait");
        var response=create(owner,"pet-portrait",List.of(input),Map.of("stepDelayMs",30000));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
        var task=response.getBody(); String id=task.get("id").asText();
        assertThat(task.get("status").asText()).isEqualTo("QUEUED");
        assertThat(task.get("simulation").get("stepDelayMs").asInt()).isEqualTo(30000);
        assertThat(response.getHeaders().getLocation().toString()).isEqualTo("/api/tasks/"+id);
        for(int i=0;i<3;i++) {
            var queried=get(owner,id);
            assertThat(queried.get("status").asText()).isEqualTo("QUEUED");
            assertThat(queried.get("steps")).allSatisfy(step->assertThat(step.get("status").asText()).isEqualTo("WAITING"));
        }
    }
    @Test void successfulStagesRunInOrderAndTerminalQueriesDoNotRegress() throws Exception {
        String id=queued(owner,"pet-portrait",List.of(upload(owner,"pet-portrait")),Map.of("stepDelayMs",0));
        worker.run(id);
        var task=get(owner,id);
        assertThat(task.get("status").asText()).isEqualTo("SUCCEEDED");
        assertThat(task.get("stage").asText()).isEqualTo("FINALIZE");
        assertThat(task.get("steps")).extracting(step->step.get("stage").asText()).containsExactly("MATERIAL_CHECK","GENERATE","FINALIZE");
        String previous=null;
        for(var step:task.get("steps")) {
            assertThat(step.get("status").asText()).isEqualTo("SUCCEEDED");
            String start=step.get("startedAt").asText(), end=step.get("finishedAt").asText();
            assertThat(end).isGreaterThanOrEqualTo(start);
            if(previous!=null) assertThat(start).isGreaterThanOrEqualTo(previous);
            previous=end;
        }
        String url=task.get("resultUrl").asText();
        var file=http.exchange(url,HttpMethod.GET,new HttpEntity<>(headers(owner)),byte[].class);
        assertThat(file.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(file.getBody()).isEqualTo(sample());
        assertThat(file.getHeaders().getContentType()).isEqualTo(MediaType.IMAGE_PNG);
        assertThat(file.getHeaders().getCacheControl()).contains("no-store");
        worker.run(id); // Cannot reclaim success; results and dates stay unchanged.
        assertThat(get(owner,id)).isEqualTo(task);
        String other=loginAs("demo-lin");
        assertThat(http.exchange(url,HttpMethod.GET,new HttpEntity<>(headers(other)),JsonNode.class).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }
    @ParameterizedTest @EnumSource(Stage.class)
    void failureStopsAllFollowingSteps(Stage failure) {
        String id=queued(owner,"pet-portrait",List.of(upload(owner,"pet-portrait")),Map.of("stepDelayMs",0,"failAtStage",failure.name()));
        worker.run(id);
        var task=get(owner,id);
        assertThat(task.get("status").asText()).isEqualTo("FAILED");
        assertThat(task.get("stage").asText()).isEqualTo(failure.name());
        assertThat(task.get("errorMessage").asText()).contains(failure.label,"模拟失败");
        assertThat(task.get("resultUrl").isNull()).isTrue();
        for(Stage stage:Stage.values()) {
            var step=task.get("steps").get(stage.ordinal());
            assertThat(step.get("status").asText()).isEqualTo(stage.ordinal()<failure.ordinal()?"SUCCEEDED":stage==failure?"FAILED":"WAITING");
            if(stage.ordinal()>failure.ordinal()) assertThat(step.get("startedAt").isNull()).isTrue();
        }
        worker.run(id); assertThat(get(owner,id)).isEqualTo(task);
    }
    @Test void runningStageIsVisibleWithoutCompletingOrDrivingItByQuery() throws Exception {
        String id=queued(owner,"pet-portrait",List.of(upload(owner,"pet-portrait")),Map.of("stepDelayMs",0));
        var entered=new CountDownLatch(1); var release=new CountDownLatch(1);
        var controlled=new TaskWorker(mapper,store,assets,STORAGE.toString(),false) {
            @Override protected void pause(int delay) throws InterruptedException {
                entered.countDown(); if(!release.await(5,TimeUnit.SECONDS)) throw new IllegalStateException("test latch timeout");
            }
        };
        try(var executor=Executors.newSingleThreadExecutor()) {
            var future=executor.submit(()->controlled.run(id));
            try {
                assertThat(entered.await(5,TimeUnit.SECONDS)).isTrue();
                for(int i=0;i<2;i++) {
                    var task=get(owner,id);
                    assertThat(task.get("status").asText()).isEqualTo("RUNNING");
                    assertThat(task.get("stage").asText()).isEqualTo("MATERIAL_CHECK");
                    assertThat(task.get("steps").get(0).get("status").asText()).isEqualTo("RUNNING");
                    assertThat(task.get("steps").get(1).get("status").asText()).isEqualTo("WAITING");
                }
            } finally { release.countDown(); }
            future.get(5,TimeUnit.SECONDS);
        }
        assertThat(get(owner,id).get("status").asText()).isEqualTo("SUCCEEDED");
    }
    @Test void multipleJobsAndOwnershipStayIndependent() throws Exception {
        String input=upload(owner,"pet-portrait"), other=loginAs("demo-lin");
        String failed=queued(owner,"pet-portrait",List.of(input),Map.of("stepDelayMs",0,"failAtStage","GENERATE"));
        String success=queued(owner,"pet-portrait",List.of(input),Map.of("stepDelayMs",0));
        worker.run(failed);
        assertThat(get(owner,success).get("status").asText()).isEqualTo("QUEUED");
        worker.run(success);
        assertThat(get(owner,failed).get("status").asText()).isEqualTo("FAILED");
        assertThat(get(owner,success).get("status").asText()).isEqualTo("SUCCEEDED");
        assertThat(http.exchange("/api/tasks/"+success,HttpMethod.GET,new HttpEntity<>(headers(other)),JsonNode.class).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        var history=http.exchange("/api/tasks",HttpMethod.GET,new HttpEntity<>(headers(owner)),JsonNode.class).getBody();
        assertThat(history.toString()).contains(failed,success);
        var otherHistory=http.exchange("/api/tasks",HttpMethod.GET,new HttpEntity<>(headers(other)),JsonNode.class).getBody();
        assertThat(otherHistory.toString()).doesNotContain(failed,success);
    }
    @Test void invalidInputsNeverCreateTasks() throws Exception {
        String input=upload(owner,"pet-portrait"), other=loginAs("demo-lin");
        assertThat(create(owner,"travel-postcard",List.of(input),Map.of()).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(create(owner,"travel-postcard",List.of(input,input),Map.of()).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(create(owner,"daily-moment",List.of(input),Map.of()).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(create(other,"pet-portrait",List.of(input),Map.of()).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(create(owner,"pet-portrait",List.of(input),Map.of("stepDelayMs",30001)).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(create(owner,"pet-portrait",List.of(input),Map.of("failAtStage","UNKNOWN")).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(create(null,"pet-portrait",List.of(input),Map.of()).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(http.postForEntity("/api/tasks",Map.of("templateId","pet-portrait","assetIds",List.of(input)),JsonNode.class).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(tasks).isEmpty();
    }
    @Test void missingInputFileFailsMaterialCheckAndDoesNotStartGeneration() throws Exception {
        String input=upload(owner,"pet-portrait");
        String id=queued(owner,"pet-portrait",List.of(input),Map.of("stepDelayMs",0));
        String stored=jdbc.queryForObject("SELECT stored_name FROM assets WHERE id=?",String.class,input);
        Files.delete(STORAGE.resolve("uploads").resolve(stored));
        worker.run(id);
        var task=get(owner,id);
        assertThat(task.get("status").asText()).isEqualTo("FAILED");
        assertThat(task.get("stage").asText()).isEqualTo("MATERIAL_CHECK");
        assertThat(task.get("steps").get(1).get("startedAt").isNull()).isTrue();
    }
    private HttpHeaders headers(String cookie) {
        var h=new HttpHeaders(); h.set("X-Studio-Request","1"); if(cookie!=null) h.set(HttpHeaders.COOKIE,cookie); return h;
    }
    private String loginAs(String user) throws Exception {
        var response=http.postForEntity("/api/auth/session",new HttpEntity<>(Map.of("userId",user),headers(null)),JsonNode.class);
        String cookie=response.getHeaders().getFirst(HttpHeaders.SET_COOKIE).split(";",2)[0];
        hashes.add(HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(cookie.substring(cookie.indexOf('=')+1).getBytes(StandardCharsets.UTF_8))));
        return cookie;
    }
    private byte[] sample() throws Exception { try(var in=getClass().getResourceAsStream("/static/demo/sample-1.png")) { return in.readAllBytes(); } }
    private String upload(String cookie,String template) {
        try {
            var part=new HttpHeaders(); part.setContentType(MediaType.IMAGE_PNG);
            var body=new LinkedMultiValueMap<String,Object>();
            body.add("templateId",template); body.add("file",new HttpEntity<>(new ByteArrayResource(sample()) { @Override public String getFilename() { return "sample.png"; } },part));
            var h=headers(cookie); h.setContentType(MediaType.MULTIPART_FORM_DATA);
            var response=http.postForEntity("/api/assets",new HttpEntity<>(body,h),JsonNode.class);
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
            String id=response.getBody().get("id").asText(); inputs.add(id); return id;
        } catch(Exception e) { throw new IllegalStateException(e); }
    }
    private ResponseEntity<JsonNode> create(String cookie,String template,List<String> ids,Map<String,Object> simulation) {
        var response=http.postForEntity("/api/tasks",new HttpEntity<>(Map.of("templateId",template,"assetIds",ids,"simulation",simulation),headers(cookie)),JsonNode.class);
        if(response.getStatusCode().is2xxSuccessful()) tasks.add(response.getBody().get("id").asText());
        return response;
    }
    private String queued(String cookie,String template,List<String> ids,Map<String,Object> simulation) {
        var response=create(cookie,template,ids,simulation); assertThat(response.getStatusCode()).isEqualTo(HttpStatus.ACCEPTED); return response.getBody().get("id").asText();
    }
    private JsonNode get(String cookie,String id) {
        var response=http.exchange("/api/tasks/"+id,HttpMethod.GET,new HttpEntity<>(headers(cookie)),JsonNode.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK); return response.getBody();
    }
}
