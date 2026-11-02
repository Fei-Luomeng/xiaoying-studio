package com.xiaoying.studio.template;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/templates")
public class TemplateController {
    private final TemplateService service;

    public TemplateController(TemplateService service) {
        this.service = service;
    }

    @GetMapping
    public List<TemplateView> list(@RequestParam(required = false) String category) {
        return service.list(category);
    }

    @GetMapping("/categories")
    public List<String> categories() {
        return service.categories();
    }

    @GetMapping("/{id}")
    public TemplateView get(@PathVariable String id) {
        return service.get(id);
    }
}
