"use client";

import Image from "next/image";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";
import { ApiError, apiRequest, mutationHeaders } from "@/lib/api";
import { acceptTask, decodeTask, decodeTasks, queryFailed, querySucceeded, stageLabels, stages, statusLabels } from "@/lib/tasks";
import type { Stage, Task, TaskState } from "@/lib/tasks";

type Workspace = { state: TaskState; querying: boolean; refresh: () => void; accepted: (task: Task) => void };
const Context = createContext<Workspace | null>(null);
function useWorkspace() { const context = useContext(Context); if (!context) throw new Error("TaskWorkspace missing"); return context; }

function Scope({ templateId, ownerId, children }: { templateId: string; ownerId: string | null; children: ReactNode }) {
  const auth = useAuth();
  const [state, setState] = useState<TaskState>({ tasks: [], queryError: null });
  const [querying, setQuerying] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; controller.current?.abort(); }; }, []);
  async function refresh() {
    if (!ownerId) return;
    controller.current?.abort();
    const request = new AbortController(); controller.current = request;
    setQuerying(true);
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; request.abort(); }, 15000);
    try {
      const response = await apiRequest(`/api/tasks?templateId=${encodeURIComponent(templateId)}`, { signal: request.signal });
      const tasks = decodeTasks(await response.json());
      if (!alive.current || controller.current !== request || request.signal.aborted) return;
      if (tasks.some((task) => task.ownerId !== ownerId || task.templateId !== templateId)) { auth.refresh(); return; }
      setState(querySucceeded(tasks));
    } catch (error) {
      if (!alive.current || controller.current !== request || (request.signal.aborted && !timedOut)) return;
      if (error instanceof ApiError && error.status === 401) { auth.refresh(); return; }
      setState((previous) => queryFailed(previous, timedOut ? "查询超时，已有任务信息已保留。" : "查询暂时失败，已有任务信息已保留，可重新查询。"));
    } finally {
      clearTimeout(timer);
      if (alive.current && controller.current === request) { controller.current = null; setQuerying(false); }
    }
  }
  const accepted = (task: Task) => {
    if (task.ownerId !== ownerId || task.templateId !== templateId) { auth.refresh(); return; }
    // Cancel a list snapshot that might have been read before this task was accepted.
    controller.current?.abort(); controller.current = null; setQuerying(false);
    setState((previous) => acceptTask(previous, task));
  };
  return <Context.Provider value={{ state, querying, refresh: () => { void refresh(); }, accepted }}>{children}</Context.Provider>;
}
export function TaskWorkspace({ templateId, children }: { templateId: string; children: ReactNode }) {
  const auth = useAuth();
  const ownerId = auth.phase === "ready" ? auth.user?.id ?? null : null;
  return <Scope key={`${ownerId}:${auth.generation}:${templateId}`} templateId={templateId} ownerId={ownerId}>{children}</Scope>;
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
      workspace.accepted(task); setMessage("任务已受理，可继续创建其他作品。点击右侧查询更新进度。");
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
export function TaskRecords() {
  const auth = useAuth(); const { state, querying, refresh } = useWorkspace();
  return <>
    <div className="section-heading"><h2 id="records-title">作品记录</h2><button type="button" className="text-button" disabled={querying || auth.phase !== "ready" || !auth.user} onClick={refresh}>{querying ? "正在查询…" : "查询 / 刷新"}</button></div>
    <p className="muted small">后台制作不受关闭页面影响。本阶段请手动查询进度及历史；自动跟踪将在下一步接入。</p>
    {state.queryError && <p role="alert" className="upload-error">{state.queryError}</p>}
    {state.tasks.length === 0 ? <div className="records-empty"><div className="empty-art" aria-hidden="true"><span>✦</span><span>◇</span></div><h3>下一份作品，从这里开始</h3><p>上传素材后开始制作，或点击查询查看已有记录。</p></div>
      : <div className="task-list">{state.tasks.map((task) => <article className={`task-card task-${task.status.toLowerCase()}`} key={task.id}>
        <div className="section-heading"><strong>{statusLabels[task.status]}</strong><time dateTime={task.createdAt}>{new Date(task.createdAt).toLocaleString("zh-CN")}</time></div>
        <p className="muted small">任务 {task.id.slice(0, 8)} · {task.stage ? stageLabels[task.stage] : "等待后台领取"}</p>
        <ol className="task-steps">{task.steps.map((step) => <li key={step.stage} data-status={step.status}>{stageLabels[step.stage]}<span>{step.status === "WAITING" ? "未开始" : step.status === "RUNNING" ? "执行中" : step.status === "SUCCEEDED" ? "已完成" : "失败"}</span></li>)}</ol>
        {task.errorMessage && <p className="upload-error">{task.errorMessage}</p>}
        <ResultPreview task={task} />
      </article>)}</div>}
    <div className="workflow-note"><h3>从照片到作品</h3><ol><li><span>01</span>素材检查</li><li><span>02</span>模拟生成</li><li><span>03</span>结果整理</li></ol><p className="muted small">模拟结果为第一张上传图片的副本，不调用真实 AI。</p></div>
  </>;
}
