package com.xiaoying.studio.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Duration;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService service;
    private final boolean secureCookie;

    public AuthController(AuthService service, @Value("${studio.cookie-secure:false}") boolean secureCookie) {
        this.service = service;
        this.secureCookie = secureCookie;
    }

    @GetMapping("/demo-users")
    public List<DemoUser> demoUsers() { return service.demoUsers(); }

    @GetMapping("/me")
    public ResponseEntity<DemoUser> me(HttpServletRequest request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.requireUser(request));
    }

    @PostMapping("/session")
    public ResponseEntity<DemoUser> login(@Valid @RequestBody LoginRequest body, HttpServletRequest request) {
        var result = service.login(body.userId(), request);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .header(HttpHeaders.SET_COOKIE, cookie(result.token(), Duration.ofDays(7)).toString()).body(result.user());
    }

    @DeleteMapping("/session")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        service.logout(request);
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cookie("", Duration.ZERO).toString()).build();
    }

    private ResponseCookie cookie(String token, Duration age) {
        return ResponseCookie.from(AuthService.COOKIE_NAME, token).path("/api").httpOnly(true)
                .sameSite("Lax").secure(secureCookie).maxAge(age).build();
    }

    public record LoginRequest(@NotBlank @Size(max = 64) String userId) {}
}
