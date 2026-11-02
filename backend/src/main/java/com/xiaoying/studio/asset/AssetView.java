package com.xiaoying.studio.asset;

import java.time.Instant;

public record AssetView(String id, String ownerId, String templateId, String originalName, String mimeType,
        long sizeBytes, int width, int height, String url, Instant createdAt) {}
