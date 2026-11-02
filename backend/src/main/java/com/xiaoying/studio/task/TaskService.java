package com.xiaoying.studio.task;

import com.xiaoying.studio.asset.AssetService;
import com.xiaoying.studio.template.TemplateService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.nio.file.*;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TaskService {
    private final TaskMapper mapper;
    private final TemplateService templates;
    private final AssetService assets;
    private final Path results;
    public TaskService(TaskMapper mapper, TemplateService templates, AssetService assets,
            @Value("${studio.storage-root:./storage}") String storageRoot) {
        this.mapper = mapper; this.templates = templates; this.assets = assets;
        results = Path.of(storageRoot).toAbsolutePath().normalize().resolve("results");
    }
    public record Simulation(@Min(0) @Max(30000) Integer stepDelayMs, Stage failAtStage) {}
    public record CreateRequest(@NotBlank @Size(max=64) String templateId,
            @NotNull @Size(min=1,max=6) List<@NotBlank @Size(max=36) String> assetIds, @Valid Simulation simulation) {}
    public record View(String id, String ownerId, String templateId, String status, Stage stage,
            String errorMessage, String resultUrl, Instant createdAt, Instant updatedAt, Instant finishedAt,
            Simulation simulation, List<StepRow> steps) {}

    @Transactional
    public View create(String userId, CreateRequest request) {
        var template = templates.get(request.templateId());
        var ids = request.assetIds();
        if (ids.size() != template.requiredImageCount() || new HashSet<>(ids).size() != ids.size())
            throw bad("请按模板要求上传准确数量的不同图片。");
        for (String id : ids) {
            var asset = assets.requireOwned(id, userId);
            if (!asset.templateId().equals(template.id()) || !template.acceptedMimeTypes().contains(asset.mimeType())
                    || asset.sizeBytes() > template.maxFileSizeBytes()) throw bad("素材不符合当前模板要求，请重新上传。");
            assets.file(asset);
        }
        Simulation simulation = request.simulation();
        int delay = simulation == null || simulation.stepDelayMs() == null ? 1500 : simulation.stepDelayMs();
        String id = UUID.randomUUID().toString();
        mapper.insert(new TaskRow(id,userId,template.id(),"QUEUED",null,simulation == null ? null : simulation.failAtStage(),
                delay,null,null,null,null,null,null));
        for (int i=0; i<ids.size(); i++) mapper.addAsset(id,i,ids.get(i));
        for (Stage stage : Stage.values()) mapper.addStep(id,stage,stage.ordinal());
        return view(mapper.find(id));
    }
    // Consistent snapshot across task and step selects, even while a worker commits a transition.
    @Transactional(readOnly=true, isolation=Isolation.REPEATABLE_READ)
    public View get(String id, String userId) { return view(requireOwned(id,userId)); }
    @Transactional(readOnly=true, isolation=Isolation.REPEATABLE_READ)
    public List<View> list(String userId, String templateId) {
        if (templateId != null && templateId.length() > 64) throw bad("模板参数过长。");
        return mapper.list(userId,templateId).stream().map(this::view).toList();
    }
    public TaskRow requireOwned(String id, String userId) {
        TaskRow row = mapper.find(id);
        if (row == null || !row.userId().equals(userId)) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"任务不存在或不属于当前用户。");
        return row;
    }
    public Path result(TaskRow row) {
        if (!row.status().equals("SUCCEEDED") || row.resultName() == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"结果尚未生成。");
        Path path = results.resolve(row.resultName()).normalize();
        if (!path.startsWith(results) || !Files.isRegularFile(path)) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"结果文件暂时不可用。");
        return path;
    }
    private View view(TaskRow row) {
        return new View(row.id(),row.userId(),row.templateId(),row.status(),row.stage(),row.errorMessage(),
                row.resultName() == null ? null : "/api/tasks/"+row.id()+"/result", utc(row.createdAt()),utc(row.updatedAt()),utc(row.finishedAt()),
                new Simulation(row.stepDelayMs(),row.failAtStage()),mapper.steps(row.id()));
    }
    private Instant utc(LocalDateTime time) { return time == null ? null : time.toInstant(ZoneOffset.UTC); }
    private ResponseStatusException bad(String reason) { return new ResponseStatusException(HttpStatus.BAD_REQUEST,reason); }
}
