package com.xiaoying.studio.task;

import com.xiaoying.studio.asset.AssetService;
import java.io.IOException;
import java.nio.file.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** One background worker drains the durable MySQL queue; GET requests never execute work. Single-instance deployment. */
@Component
@EnableScheduling
public class TaskWorker {
    private static final Logger LOG = LoggerFactory.getLogger(TaskWorker.class);
    private final TaskMapper mapper;
    private final TaskStore store;
    private final AssetService assets;
    private final Path results;
    private final boolean enabled;
    private volatile boolean ready;
    public TaskWorker(TaskMapper mapper, TaskStore store, AssetService assets,
            @Value("${studio.storage-root:./storage}") String storageRoot,
            @Value("${studio.tasks.enabled:true}") boolean enabled) {
        this.mapper=mapper; this.store=store; this.assets=assets; this.enabled=enabled;
        results=Path.of(storageRoot).toAbsolutePath().normalize().resolve("results");
    }
    @EventListener(ApplicationReadyEvent.class)
    public void initialize() {
        if (!enabled) return;
        // Explicitly fail interrupted execution; queued tasks can still be picked up. Never change terminal jobs.
        for (String id : mapper.interrupted()) store.fail(id,"服务重启，制作已中断，请重新创建任务。");
        ready=true;
    }
    @Scheduled(fixedDelayString="${studio.tasks.scan-delay-ms:500}")
    public void tick() {
        if (!enabled || !ready) return;
        try { String id=mapper.nextQueued(); if (id != null) run(id); }
        catch (RuntimeException exception) { LOG.error("Task queue temporarily unavailable",exception); }
    }
    public void run(String id) {
        if (!store.claim(id)) return;
        TaskRow task=mapper.find(id);
        Path output=null, temporary=null;
        try {
            for (Stage stage : Stage.values()) {
                store.start(id,stage);
                pause(task.stepDelayMs());
                if (stage == task.failAtStage()) throw new SimulatedFailure(stage.label+"：按演示配置模拟失败。");
                if (stage == Stage.MATERIAL_CHECK) {
                    for (String assetId : mapper.assets(id)) assets.file(assets.requireOwned(assetId,task.userId()));
                }
                String name=null, mime=null;
                if (stage == Stage.FINALIZE) {
                    var first=assets.requireOwned(mapper.assets(id).getFirst(),task.userId());
                    name=id+(first.mimeType().equals("image/png") ? ".png" : ".jpg"); mime=first.mimeType();
                    Files.createDirectories(results);
                    temporary=Files.createTempFile(results,id,".tmp");
                    Files.copy(assets.file(first),temporary,StandardCopyOption.REPLACE_EXISTING);
                    output=results.resolve(name);
                    try { Files.move(temporary,output,StandardCopyOption.ATOMIC_MOVE); }
                    catch (AtomicMoveNotSupportedException exception) { Files.move(temporary,output); }
                }
                store.finish(id,stage,name,mime);
            }
        } catch (InterruptedException exception) {
            store.fail(id,"服务停止，制作已中断，请重新创建任务。"); Thread.currentThread().interrupt();
        } catch (Exception exception) {
            if (exception instanceof SimulatedFailure) LOG.info("Task {}: {}",id,exception.getMessage());
            else LOG.warn("Task {} failed",id,exception);
            store.fail(id,exception instanceof SimulatedFailure ? exception.getMessage() : "当前阶段执行失败，素材或存储可能暂时不可用，请重新创建任务。");
        } finally {
            remove(temporary);
            // Keep only results whose success transaction was committed.
            if (output != null && !"SUCCEEDED".equals(mapper.find(id).status())) remove(output);
        }
    }
    protected void pause(int millis) throws InterruptedException { Thread.sleep(millis); }
    private void remove(Path path) {
        if (path != null) try { Files.deleteIfExists(path); } catch (IOException exception) { LOG.warn("Result cleanup failed",exception); }
    }
    private static class SimulatedFailure extends RuntimeException { SimulatedFailure(String message) { super(message); } }
}
