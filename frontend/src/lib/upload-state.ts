import type { Asset } from "./assets";

export type UploadSlot =
  | { status: "empty" }
  | { status: "uploading" | "error"; requestId: string; fileName: string; previewUrl?: string; message?: string }
  | { status: "ready"; requestId: string; fileName: string; asset: Asset };
export type UploadAction =
  | { type: "start"; index: number; requestId: string; fileName: string }
  | { type: "preview"; index: number; requestId: string; fileName: string; previewUrl: string }
  | { type: "success"; index: number; requestId: string; asset: Asset }
  | { type: "failure"; index: number; requestId: string; message: string }
  | { type: "remove"; index: number };

export function createUploadState(count: number): UploadSlot[] {
  return Array.from({ length: count }, () => ({ status: "empty" }));
}

export function uploadReducer(state: UploadSlot[], action: UploadAction): UploadSlot[] {
  const slot = state[action.index];
  if (!slot) return state;
  let next: UploadSlot;
  if (action.type === "remove") next = { status: "empty" };
  else if (action.type === "start") next = { status: "uploading", requestId: action.requestId, fileName: action.fileName };
  else {
    if (slot.status === "empty" || slot.requestId !== action.requestId || slot.status !== "uploading") return state;
    switch (action.type) {
      case "preview": next = { ...slot, fileName: action.fileName, previewUrl: action.previewUrl }; break;
      case "success": next = { status: "ready", requestId: action.requestId, fileName: action.asset.originalName, asset: action.asset }; break;
      case "failure": next = { ...slot, status: "error", message: action.message }; break;
    }
  }
  return state.map((previous, index) => index === action.index ? next : previous);
}

export function slotPreview(slot: UploadSlot): string | undefined {
  return slot.status === "ready" ? slot.asset.url : slot.status === "empty" ? undefined : slot.previewUrl;
}

export function validateUploadFile(file: { type: string; size: number }, requirements: { acceptedMimeTypes: string[]; maxFileSizeBytes: number }): string | null {
  if (!requirements.acceptedMimeTypes.includes(file.type)) return "格式不支持，请选择 JPEG 或 PNG 图片。";
  if (file.size <= 0) return "图片不能为空，请重新选择。";
  if (file.size > requirements.maxFileSizeBytes) return `图片不能超过 ${requirements.maxFileSizeBytes / 1024 / 1024} MB。`;
  return null;
}
