"use client";

import Link from "next/link";
import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { CardSkeletons, EmptyNotice, ErrorNotice } from "@/components/feedback";
import { TemplateCover } from "@/components/template-cover";
import { decodeCategories, decodeTemplates } from "@/lib/templates";
import { useResource } from "@/lib/use-resource";

function CategoryFilters({ selected, onSelect }: { selected: string; onSelect: (category: string) => void }) {
  const [revision, setRevision] = useState(0);
  return <CategoryOptions key={revision} selected={selected} onSelect={onSelect} onRetry={() => setRevision((value) => value + 1)} />;
}

function CategoryOptions({ selected, onSelect, onRetry }: { selected: string; onSelect: (category: string) => void; onRetry: () => void }) {
  const resource = useResource("/api/templates/categories", decodeCategories);
  return (
    <div className="category-row" aria-label="按分类筛选模板">
      <button type="button" className="category-chip" aria-pressed={selected === ""} onClick={() => onSelect("")}>全部模板</button>
      {resource.status === "success" && resource.data.map((category) => <button type="button" key={category} className="category-chip" aria-pressed={selected === category} onClick={() => onSelect(category)}>{category}</button>)}
      {resource.status === "loading" && <span className="muted small" role="status">正在加载分类…</span>}
      {resource.status === "error" && <button type="button" className="text-button" onClick={onRetry}>分类加载失败，点击重试</button>}
    </div>
  );
}

function TemplateResults({ category, onRetry }: { category: string; onRetry: () => void }) {
  const url = category ? `/api/templates?category=${encodeURIComponent(category)}` : "/api/templates";
  const resource = useResource(url, decodeTemplates);
  if (resource.status === "loading") return <CardSkeletons />;
  if (resource.status === "error") return <ErrorNotice message={resource.message} onRetry={onRetry} />;
  if (resource.data.length === 0) return <EmptyNotice />;
  return (
    <div className="template-grid">
      {resource.data.map((template, index) => (
        <Link className="template-card" key={template.id} href={`/templates/${encodeURIComponent(template.id)}`}>
          <div className="card-cover">
            <TemplateCover src={template.coverUrl} title={template.title} eager={index < 4} />
            <span className="image-count">{template.requiredImageCount} 张素材</span>
            <div className="cover-caption"><span>{template.category}</span><h2>{template.title}</h2><span className="card-arrow" aria-hidden="true">↗</span></div>
          </div>
          <p className="card-description">{template.description}</p>
        </Link>
      ))}
    </div>
  );
}

export function TemplateGallery() {
  const [category, setCategory] = useState("");
  const [revision, setRevision] = useState(0);
  return (
    <div className="shell">
      <SiteHeader />
      <main className="explore-main">
        <section className="intro-section" aria-labelledby="explore-title">
          <p className="eyebrow">A LITTLE INSPIRATION, A NEW CREATION</p>
          <h1 id="explore-title">日常的照片，<span>不日常的灵感。</span></h1>
          <p className="intro">从一份喜欢的模板开始，把生活里的小片段，变成值得收藏的画面。</p>
          <span className="hero-note"><span aria-hidden="true">✦</span> 为你的每一个瞬间</span>
        </section>
        <section aria-label="模板探索">
          <div className="section-heading"><h2>发现灵感</h2><span className="muted small">选一份模板，开启创作</span></div>
          <CategoryFilters selected={category} onSelect={(next) => { setCategory(next); setRevision(0); }} />
          <TemplateResults key={`${category}:${revision}`} category={category} onRetry={() => setRevision((value) => value + 1)} />
        </section>
      </main>
      <footer className="site-footer"><span>拾影 STUDIO</span><span>每一个平凡瞬间，都值得被记录。</span></footer>
    </div>
  );
}
