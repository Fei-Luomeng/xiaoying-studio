package com.xiaoying.studio.task;

import java.util.List;
import org.apache.ibatis.annotations.*;

@Mapper
public interface TaskMapper {
    @Insert("INSERT INTO tasks (id,user_id,template_id,status,fail_at_stage,step_delay_ms,created_at,updated_at) "
            + "VALUES (#{id},#{userId},#{templateId},'QUEUED',#{failAtStage},#{stepDelayMs},UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))")
    void insert(TaskRow row);
    @Insert("INSERT INTO task_assets (task_id,position,asset_id) VALUES (#{id},#{position},#{assetId})")
    void addAsset(@Param("id") String id, @Param("position") int position, @Param("assetId") String assetId);
    @Insert("INSERT INTO task_steps (task_id,stage,position,status) VALUES (#{id},#{stage},#{position},'WAITING')")
    void addStep(@Param("id") String id, @Param("stage") Stage stage, @Param("position") int position);
    @Select("SELECT * FROM tasks WHERE id=#{id}")
    TaskRow find(String id);
    @Select("<script>(SELECT * FROM tasks WHERE user_id=#{userId} <if test='templateId != null'>AND template_id=#{templateId}</if> ORDER BY created_at DESC,id LIMIT 100) "
            + "UNION (SELECT * FROM tasks WHERE user_id=#{userId} <if test='templateId != null'>AND template_id=#{templateId}</if> AND status IN ('QUEUED','RUNNING')) "
            + "ORDER BY created_at DESC,id</script>")
    List<TaskRow> list(@Param("userId") String userId, @Param("templateId") String templateId);
    @Select("SELECT asset_id FROM task_assets WHERE task_id=#{id} ORDER BY position")
    List<String> assets(String id);
    @Select("SELECT stage,status,started_at,finished_at,error_message FROM task_steps WHERE task_id=#{id} ORDER BY position")
    List<StepRow> steps(String id);
    @Select("SELECT id FROM tasks WHERE status='QUEUED' ORDER BY created_at,id LIMIT 1")
    String nextQueued();
    @Update("UPDATE tasks SET status='RUNNING',updated_at=UTC_TIMESTAMP(6) WHERE id=#{id} AND status='QUEUED'")
    int claim(String id);
    @Update("UPDATE tasks SET stage=#{stage},updated_at=UTC_TIMESTAMP(6) WHERE id=#{id} AND status='RUNNING'")
    int stage(@Param("id") String id, @Param("stage") Stage stage);
    @Update("UPDATE task_steps SET status='RUNNING',started_at=UTC_TIMESTAMP(6) WHERE task_id=#{id} AND stage=#{stage} AND status='WAITING'")
    int startStep(@Param("id") String id, @Param("stage") Stage stage);
    @Update("UPDATE task_steps SET status='SUCCEEDED',finished_at=UTC_TIMESTAMP(6) WHERE task_id=#{id} AND stage=#{stage} AND status='RUNNING'")
    int finishStep(@Param("id") String id, @Param("stage") Stage stage);
    @Update("UPDATE tasks SET status='SUCCEEDED',result_name=#{name},result_mime_type=#{mime},updated_at=UTC_TIMESTAMP(6),finished_at=UTC_TIMESTAMP(6) WHERE id=#{id} AND status='RUNNING' AND stage='FINALIZE'")
    int succeed(@Param("id") String id, @Param("name") String name, @Param("mime") String mime);
    @Update("UPDATE tasks SET status='FAILED',error_message=#{reason},updated_at=UTC_TIMESTAMP(6),finished_at=UTC_TIMESTAMP(6) WHERE id=#{id} AND status='RUNNING'")
    int fail(@Param("id") String id, @Param("reason") String reason);
    @Update("UPDATE task_steps SET status='FAILED',error_message=#{reason},finished_at=UTC_TIMESTAMP(6) WHERE task_id=#{id} AND status='RUNNING'")
    void failStep(@Param("id") String id, @Param("reason") String reason);
    @Select("SELECT id FROM tasks WHERE status='RUNNING'")
    List<String> interrupted();
}
