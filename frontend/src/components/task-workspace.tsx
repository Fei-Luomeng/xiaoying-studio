"use client";

import Image from "next/image";
import Link from "next/link";
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";
import { ApiError, apiRequest, mutationHeaders } from "@/lib/api";
import { createTaskFeed, decodeTask, decodeTasks, isPending, stageLabels, stages, statusLabels } from "@/lib/tasks";
import type { FeedSnapshot, Stage, Task } from "@/lib/tasks";

type Workspace = { state: FeedSnapshot; refresh: () => void; accepted: (task: Task) => void };
const Context = createContext<Workspace | null>(null);
function useWorkspace() { const context = useContext(Context); if (!context) throw new Error("TaskWorkspace missing"); return context; }

function Scope({ templateId, ownerId, children }: { templateId?: string; ownerId: string | null; children: ReactNode }) {
  const auth = useAuth();
  const [feed] = useState(() => createTaskFeed({
    ownerId: ownerId ?? "", templateId,
    loadHistory: async (signal) => decodeTasks(await (await apiRequest(templateId ? `/api/tasks?templateId=${encodeURIComponent(templateId)}` : "/api/tasks", { signal })).json()),
    loadTask: async (id, signal) => decodeTask(await (await apiRequest(`/api/tasks/${encodeURIComponent(id)}`, { signal })).json()),
    onIdentityLost: auth.refresh,
  }));
  const state = useSyncExternalStore(feed.subscribe, feed.getSnapshot, feed.getSnapshot);
  useEffect(() => { if (ownerId) feed.start(); return feed.stop; }, [feed, ownerId]);
  return <Context.Provider value={{ state, refresh: feed.refresh, accepted: feed.accepted }}>{children}</Context.Provider>;
}
export function TaskWorkspace({ templateId, children }: { templateId?: string; children: ReactNode }) {
  const auth = useAuth();
  const ownerId = auth.phase === "ready" ? auth.user?.id ?? null : null;
  return <Scope key={`${ownerId}:${auth.generation}:${templateId ?? "all"}`} templateId={templateId} ownerId={ownerId}>{children}</Scope>;
}

export function TaskSubmit({ templateId, assetIds, ready }: { templateId: string; assetIds: string[]; ready: boolean }) {
  const auth = useAuth(); const workspace = useWorkspace();
  const [submitting, setSubmitting] = useState(false), [message, setMessage] = useState("");
  const [delay, setDelay] = useState(1500), [failure, setFailure] = useState<Stage | "">("");
  const controller = useRef<AbortController | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; controller.current?.abort(); }; }, []);
  async function submit() {
    if (!ready || controller.current) return;
    const request = new AbortController(); controller.current = request;
    setSubmitting(true); setMessage("");
    const timer = setTimeout(() => request.abort(), 15000);
    try {
      const response = await apiRequest("/api/tasks", { method: "POST", headers: { ...mutationHeaders, "Content-Type": "application/json" },
        signal: request.signal, body: JSON.stringify({ templateId, assetIds, simulation: { stepDelayMs: delay, failAtStage: failure || null } }) });
      const task = decodeTask(await response.json());
      if (!alive.current || request.signal.aborted) return;
      if (task.ownerId !== auth.user?.id) { auth.refresh(); return; }
      workspace.accepted(task); setMessage("任务已受理，进度会自动更新。可继续创建其他作品。");
    } catch (error) {
      if (!alive.current) return;
      if (error instanceof ApiError && error.status === 401) { auth.refresh(); return; }
      setMessage(error instanceof ApiError ? error.message : "提交结果暂时无法确认，请先查询作品记录，确认任务是否已经受理，再决定是否重新提交。");
    } finally {
      clearTimeout(timer);
      if (alive.current && controller.current === request) { controller.current = null; setSubmitting(false); }
    }
  }
  return <>
    <details className="simulation-controls"><summary>模拟制作设置</summary>
      <label>每阶段耗时（毫秒）<input type="number" min="0" max="30000" step="100" value={delay} disabled={submitting}
        onChange={(event) => setDelay(Math.min(30000, Math.max(0, Number(event.target.value) || 0)))} /></label>
      <label>指定失败阶段<select value={failure} disabled={submitting} onChange={(event) => setFailure(event.target.value as Stage | "")}>
        <option value="">全部成功</option>{stages.map((stage) => <option key={stage} value={stage}>{stageLabels[stage]}失败</option>)}
      </select></label><p className="muted small">设置仅影响下一次提交的任务。每个任务独立保存配置。</p>
    </details>
    <button type="button" className="button create-button" disabled={!ready || submitting} onClick={() => { void submit(); }}>{submitting ? "正在提交…" : "开始制作"}</button>
    {message && <p className="availability-note" role="status">{message}</p>}
  </>;
}

function ResultPreview({ task }: { task: Task }) {
  const [failed, setFailed] = useState(false);
  if (!task.resultUrl) return null;
  return <div className="task-result">{failed ? <><p>结果图片暂时不可用。</p><button className="text-button" onClick={() => setFailed(false)}>重试预览</button></>
    : <a href={task.resultUrl} target="_blank" rel="noreferrer" aria-label="打开制作结果大图"><Image src={task.resultUrl} alt="模拟制作结果" width={480} height={360} unoptimized onError={() => setFailed(true)} /></a>}</div>;
}
export function TaskRecords({ allTemplates = false }: { allTemplates?: boolean }) {
  const auth = useAuth(); const { state, refresh } = useWorkspace();
  const pending = state.tasks.filter(isPending);
  const paused = pending.filter((task) => state.taskErrors[task.id]);
  const identityReady = auth.phase === "ready" && !!auth.user;
  const loading = identityReady && !state.historyLoaded && !state.historyError && state.tasks.length === 0;
  return <>
    <div className="section-heading"><h2 id="records-title">{allTemplates ? "制作记录" : "作品记录"}</h2><button type="button" className="text-button" disabled={state.historyLoading || !identityReady} onClick={refresh}>{state.historyLoading ? "正在加载…" : "刷新记录"}</button></div>
    {!identityReady ? <div className="records-empty">
      {auth.phase === "loading" || auth.phase === "switching" ? <p role="status">正在确认身份…</p>
        : auth.phase === "error" ? <><p role="alert">{auth.message}</p><button type="button" className="button" onClick={auth.refresh}>重新确认身份</button></>
        : <><h3>选择用户，查看你的作品</h3><p>请在右上角选择一个演示用户。</p></>}
    </div> : <>
      <p className="muted small" role="status">{loading ? "正在恢复制作记录…" : state.historyError ? "记录查询已暂停，已有信息保留。" : pending.length === 0 ? "没有待处理任务，自动查询已停止。" : paused.length === pending.length ? "待处理任务的查询已暂停，请恢复查询。" : `正在自动跟踪 ${pending.length - paused.length} 个任务${paused.length ? `，另有 ${paused.length} 个任务查询暂停` : ""}。后台制作不受关闭页面影响。`}</p>
      {state.historyError && <div role="alert" className="query-warning"><p>{state.historyError}</p><button type="button" className="text-button" onClick={refresh}>恢复查询</button></div>}
      {loading ? <div className="records-empty" aria-busy="true"><p>正在加载你的任务与结果…</p></div>
        : state.tasks.length === 0 ? !state.historyError && <div className="records-empty"><div className="empty-art" aria-hidden="true"><span>✦</span><span>◇</span></div><h3>还没有制作记录</h3><p>{allTemplates ? "选择一个模板，开始你的第一份作品。" : "上传素材后开始制作，进度和结果会自动显示。"}</p>{allTemplates && <Link className="button" href="/">浏览模板</Link>}</div>
        : <div className="task-list">{state.tasks.map((task) => <article className={`task-card task-${task.status.toLowerCase()}`} key={task.id}>
          <div className="section-heading"><strong>{statusLabels[task.status]}</strong><time dateTime={task.createdAt}>{new Date(task.createdAt).toLocaleString("zh-CN")}</time></div>
          <p className="muted small">任务 {task.id.slice(0, 8)} · {task.stage ? stageLabels[task.stage] : "等待后台领取"}</p>
          <ol className="task-steps">{task.steps.map((step) => <li key={step.stage} data-status={step.status}>{stageLabels[step.stage]}<span>{step.status === "WAITING" ? "未开始" : step.status === "RUNNING" ? "执行中" : step.status === "SUCCEEDED" ? "已完成" : "失败"}</span></li>)}</ol>
          {task.errorMessage && <p className="upload-error">{task.errorMessage}</p>}
          {state.taskErrors[task.id] && <div role="alert" className="query-warning"><p>{state.taskErrors[task.id]}</p><button type="button" className="text-button" onClick={refresh}>恢复查询</button></div>}
          <ResultPreview task={task} />
          {allTemplates && <Link className="task-template-link" href={`/templates/${encodeURIComponent(task.templateId)}`}>查看模板，再创作 →</Link>}
        </article>)}</div>}
    </>}
    {!allTemplates && <><Link className="task-history-link" href="/history">查看我的全部制作记录 →</Link><div className="workflow-note"><h3>从照片到作品</h3><ol><li><span>01</span>素材检查</li><li><span>02</span>模拟生成</li><li><span>03</span>结果整理</li></ol><p className="muted small">模拟结果为第一张上传图片的副本，不调用真实 AI。</p></div></>}
  </>;
}
