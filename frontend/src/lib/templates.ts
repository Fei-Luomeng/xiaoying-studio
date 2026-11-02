export type Template = {
  id: string;
  title: string;
  category: string;
  description: string;
  coverUrl: string;
  requiredImageCount: number;
  acceptedMimeTypes: string[];
  maxFileSizeBytes: number;
};

function isTemplate(value: unknown): value is Template {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return ["id", "title", "category", "description", "coverUrl"].every((key) => typeof row[key] === "string") &&
    typeof row.coverUrl === "string" && row.coverUrl.startsWith("/demo/") &&
    Number.isInteger(row.requiredImageCount) && (row.requiredImageCount as number) > 0 && (row.requiredImageCount as number) <= 6 &&
    typeof row.maxFileSizeBytes === "number" && row.maxFileSizeBytes > 0 &&
    Array.isArray(row.acceptedMimeTypes) && row.acceptedMimeTypes.every((type) => typeof type === "string");
}

export function decodeTemplate(value: unknown): Template {
  if (!isTemplate(value)) throw new Error("模板数据格式异常，请稍后重试。");
  return value;
}

export function decodeTemplates(value: unknown): Template[] {
  if (!Array.isArray(value) || !value.every(isTemplate)) throw new Error("模板列表格式异常，请稍后重试。");
  return value;
}

export function decodeCategories(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error("模板分类格式异常，请稍后重试。");
  }
  return value;
}

export function formatFileSize(bytes: number): string {
  return `${Number((bytes / 1024 / 1024).toFixed(1))} MB`;
}
