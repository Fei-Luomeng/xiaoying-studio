package com.xiaoying.studio.auth;

import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {
    public static final String COOKIE_NAME = "studio_session";
    private final SecureRandom random = new SecureRandom();
    private final AuthMapper mapper;

    public AuthService(AuthMapper mapper) { this.mapper = mapper; }

    public List<DemoUser> demoUsers() { return mapper.listDemoUsers(); }

    public DemoUser requireUser(HttpServletRequest request) {
        String token = cookieToken(request);
        DemoUser user = token == null ? null : mapper.findSessionUser(hash(token));
        if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "请先选择演示用户，或重新确认身份。");
        return user;
    }

    @Transactional
    public LoginResult login(String userId, HttpServletRequest request) {
        DemoUser user = mapper.findDemoUser(userId);
        if (user == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "演示用户不存在。");
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        mapper.deleteExpiredSessions();
        String previous = cookieToken(request);
        if (previous != null) mapper.deleteSession(hash(previous));
        mapper.insertSession(hash(token), user.id());
        return new LoginResult(user, token);
    }

    public void logout(HttpServletRequest request) {
        String token = cookieToken(request);
        if (token != null) mapper.deleteSession(hash(token));
    }

    private String cookieToken(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        for (var cookie : request.getCookies()) {
            if (COOKIE_NAME.equals(cookie.getName()) && cookie.getValue().matches("[A-Za-z0-9_-]{43}")) {
                return cookie.getValue();
            }
        }
        return null;
    }

    private String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) { throw new IllegalStateException(exception); }
    }

    public record LoginResult(DemoUser user, String token) {}
}
