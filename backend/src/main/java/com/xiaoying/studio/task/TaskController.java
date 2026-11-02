package com.xiaoying.studio.task;

import com.xiaoying.studio.auth.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {
    private final TaskService service;
    private final AuthService auth;
    public TaskController(TaskService service, AuthService auth) { this.service=service; this.auth=auth; }
    @PostMapping
    public ResponseEntity<TaskService.View> create(@Valid @RequestBody TaskService.CreateRequest body, HttpServletRequest request) {
        var task=service.create(auth.requireUser(request).id(),body);
        return ResponseEntity.accepted().location(URI.create("/api/tasks/"+task.id())).cacheControl(CacheControl.noStore()).body(task);
    }
    @GetMapping
    public ResponseEntity<List<TaskService.View>> list(@RequestParam(required=false) String templateId, HttpServletRequest request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.list(auth.requireUser(request).id(),templateId));
    }
    @GetMapping("/{id}")
    public ResponseEntity<TaskService.View> get(@PathVariable String id, HttpServletRequest request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.get(id,auth.requireUser(request).id()));
    }
    @GetMapping("/{id}/result")
    public ResponseEntity<Resource> result(@PathVariable String id, HttpServletRequest request) {
        var row=service.requireOwned(id,auth.requireUser(request).id());
        var file=service.result(row);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("X-Content-Type-Options","nosniff")
                .contentType(MediaType.parseMediaType(row.resultMimeType())).body(new FileSystemResource(file));
    }
}
