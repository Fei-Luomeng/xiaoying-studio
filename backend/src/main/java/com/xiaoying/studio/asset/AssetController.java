package com.xiaoying.studio.asset;

import com.xiaoying.studio.auth.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/assets")
public class AssetController {
    private final AssetService service;
    private final AuthService auth;

    public AssetController(AssetService service, AuthService auth) { this.service = service; this.auth = auth; }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<AssetView> upload(@RequestParam String templateId, @RequestPart MultipartFile file, HttpServletRequest request) {
        var asset = service.upload(auth.requireUser(request).id(), templateId, file);
        return ResponseEntity.status(HttpStatus.CREATED).cacheControl(CacheControl.noStore()).body(asset);
    }

    @GetMapping
    public ResponseEntity<List<AssetView>> list(HttpServletRequest request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.list(auth.requireUser(request).id()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<AssetView> get(@PathVariable String id, HttpServletRequest request) {
        var asset = service.requireOwned(id, auth.requireUser(request).id());
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.view(asset));
    }

    @GetMapping("/{id}/content")
    public ResponseEntity<Resource> content(@PathVariable String id, HttpServletRequest request) {
        var asset = service.requireOwned(id, auth.requireUser(request).id());
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(asset.mimeType()))
                .cacheControl(CacheControl.noStore()).header("X-Content-Type-Options", "nosniff")
                .body(new FileSystemResource(service.file(asset)));
    }
}
