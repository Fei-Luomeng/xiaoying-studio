package com.xiaoying.studio.asset;

import com.xiaoying.studio.template.TemplateService;
import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.*;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.MemoryCacheImageInputStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AssetService {
    private static final Logger LOG = LoggerFactory.getLogger(AssetService.class);
    private final AssetMapper mapper;
    private final TemplateService templates;
    private final Path root;

    public AssetService(AssetMapper mapper, TemplateService templates, @Value("${studio.storage-root:./storage}") String storageRoot) {
        this.mapper = mapper;
        this.templates = templates;
        this.root = Path.of(storageRoot).toAbsolutePath().normalize().resolve("uploads");
    }

    public AssetView upload(String userId, String templateId, MultipartFile file) {
        var template = templates.get(templateId);
        if (file.isEmpty()) throw bad("请选择一张非空图片。");
        if (file.getSize() > template.maxFileSizeBytes()) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "图片超过模板允许的大小，请压缩后重新上传。");
        }
        String declared = file.getContentType();
        if (declared == null || !template.acceptedMimeTypes().contains(declared)) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "图片格式不支持，请使用 JPEG 或 PNG。");
        }
        Path saved = null;
        Path temporary = null;
        try {
            byte[] bytes = file.getBytes();
            ImageInfo info = inspect(bytes);
            if (!info.mimeType().equals(declared)) throw bad("图片实际格式与声明类型不一致，请重新选择 JPEG 或 PNG。");
            String id = UUID.randomUUID().toString();
            String storedName = id + (info.mimeType().equals("image/png") ? ".png" : ".jpg");
            Files.createDirectories(root);
            temporary = Files.createTempFile(root, id, ".tmp");
            Files.write(temporary, bytes);
            saved = root.resolve(storedName);
            try { Files.move(temporary, saved, StandardCopyOption.ATOMIC_MOVE); }
            catch (AtomicMoveNotSupportedException exception) { Files.move(temporary, saved); }
            String name = Optional.ofNullable(file.getOriginalFilename()).orElse("image").replace('\\', '/');
            name = name.substring(name.lastIndexOf('/') + 1).replaceAll("[\\p{Cntrl}]", "");
            if (name.isBlank()) name = "image";
            name = name.substring(0, name.offsetByCodePoints(0, Math.min(255, name.codePointCount(0, name.length()))));
            var row = new AssetRow(id, userId, templateId, storedName, name, info.mimeType(), bytes.length,
                    info.width(), info.height(), LocalDateTime.now(ZoneOffset.UTC));
            mapper.insert(row);
            return view(row);
        } catch (IOException exception) {
            removeQuietly(saved);
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "素材保存失败，请稍后重新上传。", exception);
        } catch (RuntimeException exception) {
            removeQuietly(saved);
            throw exception;
        } finally { removeQuietly(temporary); }
    }

    private ImageInfo inspect(byte[] bytes) {
        try (var input = new MemoryCacheImageInputStream(new ByteArrayInputStream(bytes))) {
            Iterator<ImageReader> readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) throw bad("文件无法识别为有效图片，请重新选择。");
            ImageReader reader = readers.next();
            try {
                reader.setInput(input, true, true);
                String format = reader.getFormatName().toLowerCase(Locale.ROOT);
                String mime = switch (format) { case "jpeg", "jpg" -> "image/jpeg"; case "png" -> "image/png"; default -> null; };
                if (mime == null) throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "仅支持真实的 JPEG 和 PNG 图片。");
                int width = reader.getWidth(0), height = reader.getHeight(0);
                if (width <= 0 || height <= 0 || (long) width * height > 20_000_000L) {
                    throw bad("图片分辨率过大，请使用不超过 2000 万像素的图片。");
                }
                BufferedImage decoded = reader.read(0);
                if (decoded == null) throw bad("图片内容损坏，请重新选择。");
                decoded.flush();
                return new ImageInfo(mime, width, height);
            } finally { reader.dispose(); }
        } catch (IOException | IllegalArgumentException exception) {
            throw bad("图片内容不完整或已损坏，请重新选择。");
        }
    }

    public List<AssetView> list(String userId) { return mapper.listOwned(userId).stream().map(this::view).toList(); }

    public AssetRow requireOwned(String id, String userId) {
        AssetRow row = mapper.findOwned(id, userId);
        if (row == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "素材不存在或不属于当前用户。");
        return row;
    }

    public Path file(AssetRow row) {
        Path path = root.resolve(row.storedName()).normalize();
        if (!path.startsWith(root) || !Files.isRegularFile(path)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "素材文件不可用，请重新上传。");
        }
        return path;
    }

    public AssetView view(AssetRow row) {
        return new AssetView(row.id(), row.userId(), row.templateId(), row.originalName(), row.mimeType(), row.sizeBytes(),
                row.width(), row.height(), "/api/assets/" + row.id() + "/content", row.createdAt().toInstant(ZoneOffset.UTC));
    }

    private void removeQuietly(Path path) {
        if (path == null) return;
        try { Files.deleteIfExists(path); } catch (IOException exception) { LOG.warn("Unable to clean up incomplete upload", exception); }
    }

    private ResponseStatusException bad(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
    private record ImageInfo(String mimeType, int width, int height) {}
}
