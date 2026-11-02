package com.xiaoying.studio.template;

/** Database representation; storage JSON is converted before responding. */
public record TemplateRow(
        String id, String title, String category, String description, String coverUrl,
        int requiredImageCount, String acceptedMimeTypesJson, long maxFileSizeBytes) {}
