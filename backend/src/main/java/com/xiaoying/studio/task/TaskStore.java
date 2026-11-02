package com.xiaoying.studio.task;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Short transactions publish each execution boundary; no transaction spans a delay or file copy. */
@Service
public class TaskStore {
    private final TaskMapper mapper;
    public TaskStore(TaskMapper mapper) { this.mapper = mapper; }
    @Transactional
    public boolean claim(String id) { return mapper.claim(id) == 1; }
    @Transactional
    public void start(String id, Stage stage) {
        if (mapper.stage(id, stage) != 1 || mapper.startStep(id, stage) != 1) throw new IllegalStateException("Invalid stage transition");
    }
    @Transactional
    public void finish(String id, Stage stage, String name, String mime) {
        if (mapper.finishStep(id, stage) != 1) throw new IllegalStateException("Invalid step completion");
        if (stage == Stage.FINALIZE && mapper.succeed(id, name, mime) != 1) throw new IllegalStateException("Invalid task completion");
    }
    @Transactional
    public void fail(String id, String reason) {
        if (mapper.fail(id, reason) == 1) mapper.failStep(id, reason);
    }
}
