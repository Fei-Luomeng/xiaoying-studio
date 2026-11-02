package com.xiaoying.studio.template;

import java.util.List;

public record TemplateView(
        String id, String title, String category, String description, String coverUrl,
        int requiredImageCount, List<String> acceptedMimeTypes, long maxFileSizeBytes) {}
