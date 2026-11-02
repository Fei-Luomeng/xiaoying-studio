package com.xiaoying.studio.common;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Same-origin custom header prevents plain cross-site forms from mutating cookie-backed data. No CORS is enabled. */
@Configuration
public class MutationGuard implements WebMvcConfigurer {
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new HandlerInterceptor() {
            @Override
            public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
                String method = request.getMethod();
                if (!method.equals("GET") && !method.equals("HEAD") && !method.equals("OPTIONS")
                        && !"1".equals(request.getHeader("X-Studio-Request"))) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "请求校验未通过，请刷新页面后重试。");
                }
                return true;
            }
        }).addPathPatterns("/api/auth/**", "/api/assets/**", "/api/assets");
    }
}
