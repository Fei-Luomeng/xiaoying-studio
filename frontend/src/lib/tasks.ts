export const stages = ["MATERIAL_CHECK", "GENERATE", "FINALIZE"] as const;
export type Stage = typeof stages[number];
export const stageLabels: Record<Stage, string> = { MATERIAL_CHECK: "素材检查", GENERATE: "模拟生成", FINALIZE: "结果整理" };
export const statusLabels = { QUEUED: "等待处理", RUNNING: "处理中", SUCCEEDED: "制作成功", FAILED: "制作失败" };
export type Task = {
  id: string; ownerId: string; templateId: string; status: keyof typeof statusLabels; stage: Stage | null;
  errorMessage: string | null; resultUrl: string | null; createdAt: string; updatedAt: string; finishedAt: string | null;
  steps: { stage: Stage; status: "WAITING" | "RUNNING" | "SUCCEEDED" | "FAILED"; startedAt: string | null; finishedAt: string | null; errorMessage: string | null }[];
};
export function decodeTask(value: unknown): Task {
  if (typeof value !== "object" || value === null) throw new Error("任务数据格式异常。");
  const task = value as Record<string, unknown>;
  const strings = ["id", "ownerId", "templateId", "createdAt", "updatedAt"];
  if (!strings.every((key) => typeof task[key] === "string") || !Object.hasOwn(statusLabels, String(task.status))
    || (task.stage !== null && !stages.includes(task.stage as Stage))
    || !["errorMessage", "resultUrl", "finishedAt"].every((key) => task[key] === null || typeof task[key] === "string")
    || (typeof task.resultUrl === "string" && task.resultUrl !== `/api/tasks/${task.id}/result`)
    || !Array.isArray(task.steps) || task.steps.length !== 3
    || !task.steps.every((step, index) => typeof step === "object" && step !== null && step.stage === stages[index]
      && ["WAITING", "RUNNING", "SUCCEEDED", "FAILED"].includes(step.status)
      && ["startedAt", "finishedAt", "errorMessage"].every((key) => step[key] === null || typeof step[key] === "string"))) {
    throw new Error("任务数据格式异常，请重新查询。");
  }
  return task as Task;
}
export function decodeTasks(value: unknown): Task[] {
  if (!Array.isArray(value)) throw new Error("任务列表格式异常。");
  return value.map(decodeTask);
}

export type TaskState = { tasks: Task[]; queryError: string | null };
export function acceptTask(state: TaskState, task: Task): TaskState {
  return { ...state, tasks: [task, ...state.tasks.filter((item) => item.id !== task.id)] };
}
export function queryFailed(state: TaskState, message: string): TaskState {
  return { ...state, queryError: message };
}
export function querySucceeded(tasks: Task[]): TaskState {
  return { tasks, queryError: null };
}
