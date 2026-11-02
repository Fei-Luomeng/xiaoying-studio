INSERT INTO templates
  (id, title, category, description, cover_url, required_image_count,
   accepted_mime_types, max_file_size_bytes, sort_order)
VALUES
  ('travel-postcard', '旅行明信片', '创意图片', '用两张旅途照片，留下属于你的旅行记忆。', '/demo/travel-postcard.svg', 2, '["image/jpeg","image/png"]', 5242880, 1),
  ('pet-portrait', '宠物肖像', '萌宠时刻', '上传一张宠物照片，模拟制作专属肖像。', '/demo/pet-portrait.svg', 1, '["image/jpeg","image/png"]', 5242880, 2),
  ('city-poster', '城市海报', '创意图片', '把一张城市照片，变成值得收藏的海报。', '/demo/city-poster.svg', 1, '["image/jpeg","image/png"]', 5242880, 3),
  ('together', '双人纪念', '生活记录', '选择两张照片，模拟制作一张双人纪念卡。', '/demo/together.svg', 2, '["image/jpeg","image/png"]', 5242880, 4),
  ('pet-diary', '萌宠日记', '萌宠时刻', '收集两张可爱瞬间，制作宠物日记。', '/demo/pet-diary.svg', 2, '["image/jpeg","image/png"]', 5242880, 5),
  ('daily-moment', '日常一刻', '生活记录', '让一张日常照片成为一张生活卡片。', '/demo/daily-moment.svg', 1, '["image/jpeg","image/png"]', 5242880, 6);
