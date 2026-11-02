import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { TaskRecords, TaskWorkspace } from "@/components/task-workspace";

export const metadata: Metadata = { title: "我的作品 · 拾影" };

export default function HistoryPage() {
  return <div className="shell"><SiteHeader /><main className="history-main">
    <div className="history-intro"><span className="eyebrow">MY CREATIONS</span><h1>我的作品</h1><p className="muted">查看所有模板的制作记录，未完成的任务会自动更新。</p><p className="muted small">展示最近 100 条记录及全部未完成任务。</p></div>
    <TaskWorkspace><section className="records-panel" aria-labelledby="records-title"><TaskRecords allTemplates /></section></TaskWorkspace>
  </main></div>;
}
