package com.xiaoying.studio.system;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/system")
public class SystemController {
    private final SystemMapper mapper;

    public SystemController(SystemMapper mapper) {
        this.mapper = mapper;
    }

    @GetMapping("/status")
    public SystemStatus status() {
        return new SystemStatus("UP", "Xiaoying Studio", mapper.countTemplates());
    }

    public record SystemStatus(String status, String application, int templateCount) {}
}
