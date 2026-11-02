"use client";

import Image from "next/image";
import { useState } from "react";

export function TemplateCover({ src, title, eager = false }: { src: string; title: string; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className="cover-fallback"><span aria-hidden="true">◇</span><p>{title}</p><small>封面暂时无法显示</small></div>;
  return <Image src={src} alt={`${title}示例封面`} fill unoptimized loading={eager ? "eager" : "lazy"} sizes="(max-width: 760px) 50vw, (max-width: 1200px) 33vw, 25vw" onError={() => setFailed(true)} />;
}
