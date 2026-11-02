import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "拾影 · 素材工作室",
  description: "浏览模板、上传图片，跟踪你的素材制作任务。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
