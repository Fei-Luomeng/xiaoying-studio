package com.xiaoying.studio.task;

import java.time.LocalDateTime;

public record StepRow(Stage stage, String status, LocalDateTime startedAt, LocalDateTime finishedAt, String errorMessage) {}
