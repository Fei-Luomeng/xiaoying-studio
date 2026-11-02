"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type SystemStatus = { status: "UP"; application: string; templateCount: number };
type Connection =
  | { state: "loading" }
  | { state: "connected"; data: SystemStatus }
  | { state: "error"; message: string };

function isSystemStatus(value: unknown): value is SystemStatus {
  if (typeof value !== "object" || value === null) return false;
  return (
    "status" in value && value.status === "UP" &&
    "application" in value && typeof value.application === "string" &&
    "templateCount" in value && typeof value.templateCount === "number"
  );
}

export default function Home() {
  const [connection, setConnection] = useState<Connection>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function connect() {
      try {
        const response = await fetch("/api/system/status", {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("服务暂时不可用，请检查后端和数据库是否启动。");
        const data: unknown = await response.json();
        if (!isSystemStatus(data)) throw new Error("服务响应格式异常，请稍后重试。");
        if (!controller.signal.aborted) setConnection({ state: "connected", data });
      } catch (error) {
        if (controller.signal.aborted) return;
        setConnection({
          state: "error",
          message: error instanceof Error ? error.message : "连接失败，请稍后重试。",
        });
      }
    }

    void connect();
    return () => controller.abort();
  }, [attempt]);

  return (
    <div className="shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="拾影首页">
          <span className="brand-mark" aria-hidden="true">拾</span>
          <span>拾影<span className="brand-caption">STUDIO</span></span>
        </Link>
        <span className="build-label">开发中 · 工程基础</span>
      </header>
      <main>
        <p className="eyebrow">MAKE SOMETHING YOURS</p>
        <h1>把灵感，留在画面里。</h1>
        <p className="intro">一个从模板到作品的素材工作室。正在搭建基础工程，随后接入模板、图片上传和后台制作任务。</p>
        <section className="connection-card" aria-labelledby="connection-title" aria-busy={connection.state === "loading"}>
          <div className="card-heading"><span className="status-dot" data-state={connection.state} /><h2 id="connection-title">服务连接</h2></div>
          <div aria-live="polite" role="status">
            {connection.state === "loading" && <p>正在连接 Java 后端与 MySQL…</p>}
            {connection.state === "connected" && <>
              <p className="connection-success">前端 → Java → MySQL 已连通</p>
              <p className="muted">通过 MyBatis 读取到 {connection.data.templateCount} 个模板种子记录。</p>
            </>}
            {connection.state === "error" && <p className="connection-error">{connection.message}</p>}
          </div>
          <button type="button" onClick={() => {
            setConnection({ state: "loading" });
            setAttempt((value) => value + 1);
          }} disabled={connection.state === "loading"}>
            {connection.state === "loading" ? "连接中…" : "重新检查连接"}
          </button>
        </section>
        <p className="footnote">当前为工程连通性验证页，尚未开放素材制作。</p>
      </main>
    </div>
  );
}
