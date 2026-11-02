"use client";

import { useEffect, useState } from "react";

type Resource<T> =
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; message: string; httpStatus?: number };

class RequestError extends Error {
  constructor(message: string, public readonly httpStatus: number) { super(message); }
}

/** Callers key the resource component by URL/retry, giving each request fresh state. */
export function useResource<T>(url: string, decode: (value: unknown) => T): Resource<T> {
  const [resource, setResource] = useState<Resource<T>>({ status: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 15000);
    async function load() {
      try {
        const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) {
          const problem: unknown = await response.json().catch(() => null);
          const message = typeof problem === "object" && problem !== null && "detail" in problem && typeof problem.detail === "string"
            ? problem.detail : "暂时无法加载内容，请检查服务连接后重试。";
          throw new RequestError(message, response.status);
        }
        const data = decode(await response.json());
        if (active) setResource({ status: "success", data });
      } catch (error) {
        if (!active) return;
        setResource({
          status: "error",
          message: timedOut ? "请求超时，请稍后重试。" : error instanceof TypeError ? "网络连接异常，请检查连接后重试。" : error instanceof Error ? error.message : "请求失败，请重试。",
          httpStatus: error instanceof RequestError ? error.httpStatus : undefined,
        });
      } finally { clearTimeout(timeout); }
    }
    void load();
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [url, decode]);
  return resource;
}
