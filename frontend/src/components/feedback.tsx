import Link from "next/link";

export function ErrorNotice({ message, onRetry, notFound = false }: { message: string; onRetry: () => void; notFound?: boolean }) {
  return (
    <div className="feedback error-notice" role="alert">
      <span className="feedback-icon" aria-hidden="true">!</span>
      <h2>{notFound ? "没有找到这个模板" : "暂时无法加载"}</h2>
      <p>{message}</p>
      {notFound ? <Link className="button" href="/">返回模板列表</Link> : <button className="button" type="button" onClick={onRetry}>重新加载</button>}
    </div>
  );
}

export function EmptyNotice() {
  return <div className="feedback" role="status"><span className="feedback-icon" aria-hidden="true">◇</span><h2>这里还没有模板</h2><p>试试切换其他分类，发现更多灵感。</p></div>;
}

export function CardSkeletons() {
  return <div className="template-grid" aria-label="正在加载模板" role="status">{Array.from({ length: 6 }, (_, index) => <div key={index} className="skeleton-card" aria-hidden="true" />)}<span className="sr-only">正在加载模板…</span></div>;
}
