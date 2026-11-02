"use client";

import Image from "next/image";
import { useEffect, useId, useReducer, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ApiError, apiRequest, mutationHeaders } from "@/lib/api";
import { decodeAsset } from "@/lib/assets";
import type { Template } from "@/lib/templates";
import { createUploadState, slotPreview, uploadReducer, validateUploadFile } from "@/lib/upload-state";
import type { UploadSlot } from "@/lib/upload-state";
import { TaskSubmit } from "@/components/task-workspace";

function UploadPreview({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? <span className="upload-preview-fallback">预览暂时不可用，可重新选择图片</span>
    : <Image fill unoptimized src={src} alt={`${name}预览`} sizes="(max-width: 760px) 45vw, 200px" onError={() => setFailed(true)} />;
}

function Slot({ slot, index, accept, notice, onChoose, onRemove, onRetry }: {
  slot: UploadSlot; index: number; accept: string; notice?: string;
  onChoose: (source: File | "sample") => void; onRemove: () => void; onRetry: () => void;
}) {
  const id = useId();
  const preview = slotPreview(slot);
  return <div className="upload-slot" role="group" aria-label={`第 ${index + 1} 张图片上传`} aria-busy={slot.status === "uploading"}>
    <input id={id} type="file" accept={accept} className="sr-only upload-input" aria-label={`选择第 ${index + 1} 张图片`}
      onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) onChoose(file); }} />
    <label htmlFor={id} className="upload-target">
      {preview ? <UploadPreview key={preview} src={preview} name={slot.status === "empty" ? "图片" : slot.fileName} />
        : <><span className="upload-plus" aria-hidden="true">＋</span><span>选择图片 {index + 1}</span></>}
      {slot.status === "uploading" && <span className="upload-overlay">正在上传…</span>}
      {slot.status === "ready" && <span className="upload-ready">已上传</span>}
    </label>
    <div className="upload-controls">
      <label htmlFor={id} className="upload-replace">{slot.status === "empty" ? "选择图片" : "替换"}</label>
      {slot.status !== "empty" && <button type="button" className="upload-remove" aria-label={`移除第 ${index + 1} 张图片`} onClick={onRemove}>移除</button>}
    </div>
    <button type="button" className="sample-button" onClick={() => onChoose("sample")}>使用示例图</button>
    {slot.status !== "empty" && <p className="upload-filename" title={slot.fileName}>{slot.fileName}</p>}
    {slot.status === "ready" && <span className="sr-only" role="status">第 {index + 1} 张图片上传成功</span>}
    {slot.status === "error" && <div className="upload-error" role="alert"><span>{slot.message}</span><button type="button" onClick={onRetry}>重新上传</button></div>}
    {notice && <p className="upload-error" role="alert">{notice}</p>}
  </div>;
}

function UploadSlots({ template }: { template: Template }) {
  const auth = useAuth();
  const [slots, dispatch] = useReducer(uploadReducer, template.requiredImageCount, createUploadState);
  const [notices, setNotices] = useState<Record<number, string>>({});
  const controllers = useRef(new Map<number, AbortController>());
  const previews = useRef(new Map<number, string>());
  const files = useRef(new Map<number, File>());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const requests = controllers.current, urls = previews.current, selected = files.current;
    return () => {
      mounted.current = false;
      requests.forEach((request) => request.abort()); requests.clear();
      urls.forEach((url) => URL.revokeObjectURL(url)); urls.clear(); selected.clear();
    };
  }, []);

  const releasePreview = (index: number) => {
    const url = previews.current.get(index);
    if (url) URL.revokeObjectURL(url);
    previews.current.delete(index);
  };

  async function choose(index: number, source: File | "sample") {
    if (source !== "sample") {
      const invalid = validateUploadFile(source, template);
      if (invalid) { setNotices((previous) => ({ ...previous, [index]: invalid })); return; }
    }
    setNotices((previous) => ({ ...previous, [index]: "" }));
    controllers.current.get(index)?.abort();
    releasePreview(index);
    files.current.delete(index);
    const controller = new AbortController();
    controllers.current.set(index, controller);
    const requestId = crypto.randomUUID();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 30000);
    dispatch({ type: "start", index, requestId, fileName: source === "sample" ? "示例图片.png" : source.name });
    try {
      const file = source === "sample"
        ? new File([await (await apiRequest(`/demo/sample-${index % 2 + 1}.png`, { signal: controller.signal })).blob()], `示例图片-${index + 1}.png`, { type: "image/png" })
        : source;
      if (!mounted.current || controller.signal.aborted) return;
      const invalid = validateUploadFile(file, template);
      if (invalid) throw new Error(invalid);
      files.current.set(index, file);
      const previewUrl = URL.createObjectURL(file);
      previews.current.set(index, previewUrl);
      dispatch({ type: "preview", index, requestId, fileName: file.name, previewUrl });
      const body = new FormData(); body.append("templateId", template.id); body.append("file", file);
      const response = await apiRequest("/api/assets", { method: "POST", headers: mutationHeaders, body, signal: controller.signal });
      const asset = decodeAsset(await response.json());
      if (!mounted.current || controller.signal.aborted || controllers.current.get(index) !== controller) return;
      if (asset.ownerId !== auth.user?.id) { auth.refresh(); return; }
      dispatch({ type: "success", index, requestId, asset });
    } catch (error) {
      if (!mounted.current || controllers.current.get(index) !== controller || (controller.signal.aborted && !timedOut)) return;
      if (error instanceof ApiError && error.status === 401) { auth.refresh(); return; }
      dispatch({ type: "failure", index, requestId,
        message: timedOut ? "上传超时，请重试。" : error instanceof TypeError ? "网络连接异常，请重试。" : error instanceof Error ? error.message : "上传失败，请重试。" });
    } finally {
      clearTimeout(timer);
      if (controllers.current.get(index) === controller) controllers.current.delete(index);
    }
  }

  function remove(index: number) {
    controllers.current.get(index)?.abort(); controllers.current.delete(index);
    releasePreview(index); files.current.delete(index);
    setNotices((previous) => ({ ...previous, [index]: "" }));
    dispatch({ type: "remove", index });
  }

  const readyCount = slots.filter((slot) => slot.status === "ready").length;
  const uploading = slots.some((slot) => slot.status === "uploading");
  return <>
    <p className="upload-owner">{auth.user?.displayName}的素材 · 支持上传、替换与移除</p>
    <div className="upload-placeholders">
      {slots.map((slot, index) => <Slot key={index} index={index} slot={slot} accept={template.acceptedMimeTypes.join(",")} notice={notices[index]}
        onChoose={(source) => { void choose(index, source); }} onRemove={() => remove(index)}
        onRetry={() => { void choose(index, files.current.get(index) ?? "sample"); }} />)}
    </div>
    <p className="upload-summary" role="status">{uploading ? "图片正在上传，请稍候。" : `已准备 ${readyCount} / ${template.requiredImageCount} 张素材。`}</p>
    <TaskSubmit templateId={template.id} assetIds={slots.flatMap((slot) => slot.status === "ready" ? [slot.asset.id] : [])} ready={!uploading && readyCount === template.requiredImageCount} />
    <p className="availability-note">素材和任务保存在服务端。切换用户会清空本页选择，已受理任务继续制作。</p>
  </>;
}

export function UploadPanel({ template }: { template: Template }) {
  const auth = useAuth();
  if (auth.phase === "loading" || auth.phase === "switching") return <p className="availability-note" role="status">正在确认身份，请稍候…</p>;
  if (auth.phase === "error") return <div className="identity-notice" role="alert"><p>{auth.message}</p><button type="button" className="text-button" onClick={auth.refresh}>重新确认身份</button></div>;
  if (!auth.user) return <div className="identity-notice"><p>先在右上角选择一个演示用户，再上传你的图片。</p><small>不同用户的素材分别保存。</small></div>;
  return <UploadSlots key={`${auth.user.id}:${auth.generation}:${template.id}`} template={template} />;
}
