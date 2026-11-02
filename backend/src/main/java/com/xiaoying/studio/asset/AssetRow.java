package com.xiaoying.studio.asset;

import java.time.LocalDateTime;

public record AssetRow(String id, String userId, String templateId, String storedName,
        String originalName, String mimeType, long sizeBytes, int width, int height, LocalDateTime createdAt) {}
