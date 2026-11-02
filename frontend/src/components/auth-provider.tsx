"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ApiError, apiRequest, mutationHeaders } from "@/lib/api";

export type DemoUser = { id: string; displayName: string };
type Identity = { phase: "loading" | "ready" | "switching" | "error"; user: DemoUser | null; generation: number; message?: string };
type AuthContextValue = Identity & { refresh: () => void; switchUser: (id: string | null) => Promise<void> };
const AuthContext = createContext<AuthContextValue | null>(null);
const IDENTITY_EVENT = "studio:identity-change";

export function decodeUser(value: unknown): DemoUser {
  if (typeof value !== "object" || value === null || !("id" in value) || !("displayName" in value)
      || typeof value.id !== "string" || typeof value.displayName !== "string") throw new Error("用户数据格式异常，请重试。");
  return { id: value.id, displayName: value.displayName };
}

export function decodeUsers(value: unknown): DemoUser[] {
  if (!Array.isArray(value)) throw new Error("演示用户列表格式异常。");
  return value.map(decodeUser);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [identity, setIdentity] = useState<Identity>({ phase: "loading", user: null, generation: 0 });
  const [revision, setRevision] = useState(0);
  const sequence = useRef(0);
  const currentRequest = useRef<AbortController | null>(null);

  const refresh = useCallback(() => {
    sequence.current += 1;
    currentRequest.current?.abort();
    setIdentity((previous) => ({ phase: "loading", user: null, generation: previous.generation + 1 }));
    setRevision((previous) => previous + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    currentRequest.current?.abort();
    currentRequest.current = controller;
    const request = ++sequence.current;
    const timer = setTimeout(() => controller.abort(), 15000);
    async function restore() {
      try {
        const response = await apiRequest("/api/auth/me", { signal: controller.signal });
        const user = decodeUser(await response.json());
        if (request === sequence.current) setIdentity((previous) => ({ ...previous, phase: "ready", user, message: undefined }));
      } catch (error) {
        if (request !== sequence.current) return;
        if (error instanceof ApiError && error.status === 401) {
          setIdentity((previous) => ({ ...previous, phase: "ready", user: null, message: undefined }));
        } else {
          setIdentity((previous) => ({ ...previous, phase: "error", user: null, message: "身份确认失败，请重新检查连接。" }));
        }
      } finally { clearTimeout(timer); }
    }
    void restore();
    return () => { sequence.current += 1; controller.abort(); clearTimeout(timer); };
  }, [revision]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => { if (event.key === IDENTITY_EVENT) refresh(); };
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener("storage", onStorage); currentRequest.current?.abort(); };
  }, [refresh]);

  const switchUser = useCallback(async (id: string | null) => {
    currentRequest.current?.abort();
    const controller = new AbortController();
    currentRequest.current = controller;
    const request = ++sequence.current;
    const timer = setTimeout(() => controller.abort(), 15000);
    setIdentity((previous) => ({ phase: "switching", user: null, generation: previous.generation + 1 }));
    try {
      const response = await apiRequest("/api/auth/session", {
        method: id === null ? "DELETE" : "POST",
        headers: { ...mutationHeaders, "Content-Type": "application/json" },
        body: id === null ? undefined : JSON.stringify({ userId: id }),
        signal: controller.signal,
      });
      const user = id === null ? null : decodeUser(await response.json());
      if (request !== sequence.current) return;
      setIdentity((previous) => ({ ...previous, phase: "ready", user, message: undefined }));
      try { localStorage.setItem(IDENTITY_EVENT, `${Date.now()}:${Math.random()}`); } catch { /* Storage can be disabled. No credentials are stored here. */ }
    } catch (error) {
      if (request !== sequence.current) return;
      setIdentity((previous) => ({ ...previous, phase: "error", user: null,
        message: error instanceof ApiError ? error.message : "切换用户未确认成功，请重新确认身份。" }));
    } finally { clearTimeout(timer); }
  }, []);

  return <AuthContext.Provider value={{ ...identity, refresh, switchUser }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("User controls require AuthProvider");
  return value;
}
