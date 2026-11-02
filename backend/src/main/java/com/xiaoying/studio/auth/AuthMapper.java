package com.xiaoying.studio.auth;

import java.util.List;
import org.apache.ibatis.annotations.*;

@Mapper
public interface AuthMapper {
    @Select("SELECT id, display_name FROM users WHERE is_demo = TRUE ORDER BY id")
    List<DemoUser> listDemoUsers();

    @Select("SELECT id, display_name FROM users WHERE id = #{id} AND is_demo = TRUE")
    DemoUser findDemoUser(String id);

    @Select("SELECT u.id, u.display_name FROM user_sessions s JOIN users u ON u.id = s.user_id "
            + "WHERE s.token_hash = #{hash} AND s.expires_at > UTC_TIMESTAMP(6)")
    DemoUser findSessionUser(String hash);

    @Insert("INSERT INTO user_sessions (token_hash, user_id, expires_at) "
            + "VALUES (#{hash}, #{userId}, DATE_ADD(UTC_TIMESTAMP(6), INTERVAL 7 DAY))")
    void insertSession(@Param("hash") String hash, @Param("userId") String userId);

    @Delete("DELETE FROM user_sessions WHERE token_hash = #{hash}")
    void deleteSession(String hash);

    @Delete("DELETE FROM user_sessions WHERE expires_at <= UTC_TIMESTAMP(6)")
    void deleteExpiredSessions();
}
