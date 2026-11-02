export type Asset = {
  id: string;
  ownerId: string;
  templateId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
  url: string;
  createdAt: string;
};

export function decodeAsset(value: unknown): Asset {
  if (typeof value !== "object" || value === null) throw new Error("素材响应格式异常，请重试。");
  const row = value as Record<string, unknown>;
  if (!["id", "ownerId", "templateId", "originalName", "mimeType", "url", "createdAt"].every((key) => typeof row[key] === "string") ||
      !["sizeBytes", "width", "height"].every((key) => typeof row[key] === "number" && (row[key] as number) > 0) ||
      !(row.url as string).startsWith("/api/assets/")) throw new Error("素材响应格式异常，请重试。");
  return row as Asset;
}
