package com.xiaoying.studio.asset;

import java.util.List;
import org.apache.ibatis.annotations.*;

@Mapper
public interface AssetMapper {
    String COLUMNS = "id, user_id, template_id, stored_name, original_name, mime_type, size_bytes, width, height, created_at";

    @Insert("INSERT INTO assets (" + COLUMNS + ") VALUES (#{id}, #{userId}, #{templateId}, #{storedName}, "
            + "#{originalName}, #{mimeType}, #{sizeBytes}, #{width}, #{height}, #{createdAt})")
    void insert(AssetRow asset);

    @Select("SELECT " + COLUMNS + " FROM assets WHERE id = #{id} AND user_id = #{userId}")
    AssetRow findOwned(@Param("id") String id, @Param("userId") String userId);

    @Select("SELECT " + COLUMNS + " FROM assets WHERE user_id = #{userId} ORDER BY created_at DESC, id LIMIT 100")
    List<AssetRow> listOwned(String userId);
}
