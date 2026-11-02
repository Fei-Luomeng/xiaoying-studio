SET NAMES utf8mb4;
CREATE TABLE IF NOT EXISTS tasks (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  template_id VARCHAR(64) NOT NULL,
  status VARCHAR(16) NOT NULL,
  stage VARCHAR(24) NULL,
  fail_at_stage VARCHAR(24) NULL,
  step_delay_ms INT NOT NULL,
  error_message VARCHAR(512) NULL,
  result_name VARCHAR(48) NULL,
  result_mime_type VARCHAR(32) NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  finished_at DATETIME(6) NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (template_id) REFERENCES templates(id),
  INDEX idx_tasks_owner (user_id, created_at),
  INDEX idx_tasks_queue (status, created_at),
  CHECK (status IN ('QUEUED','RUNNING','SUCCEEDED','FAILED')),
  CHECK (step_delay_ms BETWEEN 0 AND 30000)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS task_assets (
  task_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  position INT NOT NULL,
  asset_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY (task_id, position),
  UNIQUE KEY uk_task_asset (task_id, asset_id),
  FOREIGN KEY (task_id) REFERENCES tasks(id),
  FOREIGN KEY (asset_id) REFERENCES assets(id)
);
CREATE TABLE IF NOT EXISTS task_steps (
  task_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  stage VARCHAR(24) NOT NULL,
  position INT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'WAITING',
  started_at DATETIME(6) NULL,
  finished_at DATETIME(6) NULL,
  error_message VARCHAR(512) NULL,
  PRIMARY KEY (task_id, stage),
  FOREIGN KEY (task_id) REFERENCES tasks(id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
