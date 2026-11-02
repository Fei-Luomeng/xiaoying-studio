package com.xiaoying.studio.common;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiExceptionHandler {
    private static final Logger LOG = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(ResponseStatusException.class)
    public ProblemDetail handleStatus(ResponseStatusException exception) {
        return ProblemDetail.forStatusAndDetail(exception.getStatusCode(),
                exception.getReason() == null ? "请求无法完成，请稍后重试。" : exception.getReason());
    }

    @ExceptionHandler(DataAccessException.class)
    public ProblemDetail handleDatabase(DataAccessException exception) {
        LOG.error("Database operation failed", exception);
        return ProblemDetail.forStatusAndDetail(HttpStatus.SERVICE_UNAVAILABLE,
                "数据服务暂时不可用，请稍后重试。");
    }
}
