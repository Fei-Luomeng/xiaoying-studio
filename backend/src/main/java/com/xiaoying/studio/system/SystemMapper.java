package com.xiaoying.studio.system;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface SystemMapper {
    @Select("SELECT COUNT(*) FROM templates")
    int countTemplates();
}
