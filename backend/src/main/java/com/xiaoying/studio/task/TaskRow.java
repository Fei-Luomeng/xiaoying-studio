package com.xiaoying.studio.task;

import java.time.LocalDateTime;

public record TaskRow(String id, String userId, String templateId, String status, Stage stage,
        Stage failAtStage, int stepDelayMs, String errorMessage, String resultName, String resultMimeType,
        LocalDateTime createdAt, LocalDateTime updatedAt, LocalDateTime finishedAt) {}
