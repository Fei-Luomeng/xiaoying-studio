-- Stored times use UTC; the frontend will format them in the viewer's locale.
CREATE TABLE templates (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(128) NOT NULL,
    category VARCHAR(64) NOT NULL,
    description VARCHAR(512) NOT NULL,
    cover_url VARCHAR(255) NOT NULL,
    required_image_count TINYINT UNSIGNED NOT NULL,
    accepted_mime_types JSON NOT NULL,
    max_file_size_bytes INT UNSIGNED NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    CONSTRAINT chk_template_image_count CHECK (required_image_count BETWEEN 1 AND 6),
    INDEX idx_templates_category (category, sort_order)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
