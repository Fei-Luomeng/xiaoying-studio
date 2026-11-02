export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

export const mutationHeaders = { "X-Studio-Request": "1" };

export async function apiRequest(path: string, options: RequestInit = {}): Promise<Response> {
  const response = await fetch(path, { ...options, credentials: "same-origin", cache: "no-store" });
  if (!response.ok) {
    const problem: unknown = await response.json().catch(() => null);
    const detail = typeof problem === "object" && problem !== null && "detail" in problem && typeof problem.detail === "string"
      ? problem.detail : "请求暂时无法完成，请稍后重试。";
    throw new ApiError(detail, response.status);
  }
  return response;
}
