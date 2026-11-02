"use client";

import Link from "next/link";
import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { ErrorNotice } from "@/components/feedback";
import { TemplateCover } from "@/components/template-cover";
import { decodeTemplate, formatFileSize } from "@/lib/templates";
import { useResource } from "@/lib/use-resource";
import { UploadPanel } from "@/components/upload-panel";

function DetailContent({ templateId, onRetry }: { templateId: string; onRetry: () => void }) {
  const resource = useResource(`/api/templates/${encodeURIComponent(templateId)}`, decodeTemplate);
  if (resource.status === "loading") return <div className="detail-loading" role="status"><div className="skeleton-card" /><p className="muted">正在加载模板详情…</p></div>;
  if (resource.status === "error") return <ErrorNotice message={resource.message} notFound={resource.httpStatus === 404} onRetry={onRetry} />;
  const template = resource.data;
  return (
    <div className="detail-grid">
      <section className="detail-panel" aria-labelledby="template-title">
        <div className="detail-title"><span className="eyebrow">{template.category}</span><h1 id="template-title">{template.title}</h1><p className="muted">{template.description}</p></div>
        <div className="detail-cover"><TemplateCover src={template.coverUrl} title={template.title} eager /></div>
        <section className="requirements" aria-labelledby="requirements-title">
          <h2 id="requirements-title">准备你的素材</h2>
          <dl><div><dt>图片数量</dt><dd>{template.requiredImageCount} 张</dd></div><div><dt>支持格式</dt><dd>{template.acceptedMimeTypes.map((type) => type.replace("image/", "").toUpperCase()).join(" / ")}</dd></div><div><dt>单张大小</dt><dd>不超过 {formatFileSize(template.maxFileSizeBytes)}</dd></div></dl>
          <UploadPanel template={template} />
        </section>
      </section>
      <section className="records-panel" aria-labelledby="records-title">
        <div className="section-heading"><h2 id="records-title">作品记录</h2><span className="muted small">留住每一次灵感</span></div>
        <div className="records-empty"><div className="empty-art" aria-hidden="true"><span>✦</span><span>◇</span></div><h3>下一份作品，从这里开始</h3><p>制作功能开放后，你可以在这里查看<br />处理进度和完成的作品。</p></div>
        <div className="workflow-note"><h3>从照片到作品</h3><ol><li><span>01</span>素材检查</li><li><span>02</span>模拟生成</li><li><span>03</span>结果整理</li></ol><p className="muted small">本项目使用模拟生成器，无需接入真实 AI 服务。</p></div>
      </section>
    </div>
  );
}

export function TemplateDetail({ templateId }: { templateId: string }) {
  const [revision, setRevision] = useState(0);
  return <div className="shell"><SiteHeader /><main className="detail-main"><Link className="back-link" href="/">← 返回模板列表</Link><DetailContent key={revision} templateId={templateId} onRetry={() => setRevision((value) => value + 1)} /></main></div>;
}
