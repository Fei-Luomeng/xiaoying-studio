SET NAMES utf8mb4;

INSERT INTO users (id, display_name, is_demo)
VALUES ('demo-chen', '小陈', TRUE), ('demo-lin', '小林', TRUE)
AS seed ON DUPLICATE KEY UPDATE display_name = seed.display_name, is_demo = seed.is_demo;
