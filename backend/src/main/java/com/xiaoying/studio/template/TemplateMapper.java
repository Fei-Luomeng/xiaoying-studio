package com.xiaoying.studio.template;

import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface TemplateMapper {
    String COLUMNS = "id, title, category, description, cover_url, required_image_count, "
            + "accepted_mime_types AS accepted_mime_types_json, max_file_size_bytes";

    @Select({"<script>", "SELECT " + COLUMNS + " FROM templates",
            "<if test='category != null'>WHERE category = #{category}</if>",
            "ORDER BY sort_order, id", "</script>"})
    List<TemplateRow> findAll(@Param("category") String category);

    @Select("SELECT " + COLUMNS + " FROM templates WHERE id = #{id}")
    TemplateRow findById(@Param("id") String id);

    @Select("SELECT category FROM templates GROUP BY category ORDER BY MIN(sort_order), category")
    List<String> findCategories();
}
