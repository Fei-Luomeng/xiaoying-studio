package com.xiaoying.studio.template;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TemplateService {
    private final TemplateMapper mapper;
    private final ObjectMapper json;

    public TemplateService(TemplateMapper mapper, ObjectMapper json) {
        this.mapper = mapper;
        this.json = json;
    }

    public List<String> categories() {
        return mapper.findCategories();
    }

    public List<TemplateView> list(String category) {
        String filter = category == null || category.isBlank() ? null : category.strip();
        if (filter != null && filter.length() > 64) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "分类名称不能超过 64 个字符。");
        }
        return mapper.findAll(filter).stream().map(this::toView).toList();
    }

    public TemplateView get(String id) {
        TemplateRow row = mapper.findById(id);
        if (row == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "模板不存在或已下架，请返回列表选择其他模板。");
        }
        return toView(row);
    }

    private TemplateView toView(TemplateRow row) {
        try {
            List<String> mimeTypes = json.readValue(row.acceptedMimeTypesJson(), new TypeReference<>() {});
            return new TemplateView(row.id(), row.title(), row.category(), row.description(), row.coverUrl(),
                    row.requiredImageCount(), mimeTypes, row.maxFileSizeBytes());
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("模板素材类型配置无效：" + row.id(), exception);
        }
    }
}
