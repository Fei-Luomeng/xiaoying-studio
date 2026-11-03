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
  if (!strings.every((key) => typeof task[key] === "string" && task[key] !== "")
    || !["createdAt", "updatedAt"].every((key) => Number.isFinite(Date.parse(String(task[key]))))
    || !Object.hasOwn(statusLabels, String(task.status))
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

export function isPending(task: Task): boolean { return task.status === "QUEUED" || task.status === "RUNNING"; }

/** Merge concurrent history/individual responses without regressing a newer or terminal record. */
export function mergeTasks(current: Task[], incoming: Task[]): Task[] {
  const records = new Map(current.map((task) => [task.id, task]));
  for (const task of incoming) {
    const previous = records.get(task.id);
    // Java timestamps retain microseconds; Date.parse alone truncates those to milliseconds.
    const fraction = (time: string) => (time.match(/\.(\d+)Z$/)?.[1] ?? "").padEnd(9, "0");
    const newer = !previous || Date.parse(task.updatedAt) > Date.parse(previous.updatedAt)
      || (Date.parse(task.updatedAt) === Date.parse(previous.updatedAt) && fraction(task.updatedAt) >= fraction(previous.updatedAt));
    if (!previous || (isPending(previous) && newer)) records.set(task.id, task);
  }
  return [...records.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id));
}

type Timer = ReturnType<typeof setTimeout>;
export type FeedSnapshot = {
  tasks: Task[]; historyLoaded: boolean; historyLoading: boolean; historyError: string | null;
  taskErrors: Record<string, string>; polling: boolean;
};
type FeedOptions = {
  ownerId: string; templateId?: string;
  loadHistory: (signal: AbortSignal) => Promise<Task[]>;
  loadTask: (id: string, signal: AbortSignal) => Promise<Task>;
  onIdentityLost: () => void;
  schedule?: (callback: () => void, milliseconds: number) => Timer;
  cancel?: (timer: Timer) => void;
};

/** The same controller is used by React and deterministic lifecycle tests; no work starts until start(). */
export function createTaskFeed(options: FeedOptions) {
  const schedule = options.schedule ?? setTimeout, cancel = options.cancel ?? clearTimeout;
  let snapshot: FeedSnapshot = { tasks: [], historyLoaded: false, historyLoading: false, historyError: null, taskErrors: {}, polling: false };
  let active = false;
  let timer: Timer | null = null;
  let round: object | null = null;
  const listeners = new Set<() => void>();
  const requests = new Map<string, { controller: AbortController; deadline: Timer }>();
  const emit = (patch: Partial<FeedSnapshot>) => {
    snapshot = { ...snapshot, ...patch }; listeners.forEach((listener) => listener());
  };
  const eligible = () => snapshot.tasks.filter((task) => isPending(task) && !snapshot.taskErrors[task.id]);
  const clearTimer = () => { if (timer !== null) cancel(timer); timer = null; };
  const abort = (key: string) => {
    const request = requests.get(key);
    if (request) { requests.delete(key); cancel(request.deadline); request.controller.abort(); }
  };
  const stop = () => {
    active = false; clearTimer(); round = null;
    for (const key of requests.keys()) abort(key);
    if (snapshot.polling || snapshot.historyLoading) emit({ polling: false, historyLoading: false });
  };
  const loseIdentity = () => {
    stop(); emit({ tasks: [], taskErrors: {}, historyLoading: false, polling: false }); options.onIdentityLost();
  };
  const valid = (task: Task) => task.ownerId === options.ownerId && (!options.templateId || task.templateId === options.templateId);

  async function request<T>(key: string, operation: (signal: AbortSignal) => Promise<T>,
      success: (data: T) => void, failure: (message: string) => void) {
    abort(key);
    const controller = new AbortController();
    let timedOut = false;
    let deadline!: Timer;
    const expiration = new Promise<never>((_, reject) => {
      deadline = schedule(() => { timedOut = true; controller.abort(); reject(new Error("timeout")); }, 15000);
    });
    const entry = { controller, deadline }; requests.set(key, entry);
    try {
      const data = await Promise.race([operation(controller.signal), expiration]);
      if (active && requests.get(key) === entry && !controller.signal.aborted) success(data);
    } catch (error) {
      if (!active || requests.get(key) !== entry) return;
      if (typeof error === "object" && error !== null && "status" in error && error.status === 401) { loseIdentity(); return; }
      failure(timedOut ? "查询超时，已保留上次状态。" : "查询暂时不可用，已保留上次状态。请恢复查询。");
    } finally {
      cancel(deadline);
      if (requests.get(key) === entry) requests.delete(key);
    }
  }
  function schedulePoll() {
    if (!active || round || timer !== null || snapshot.historyLoading || snapshot.historyError || eligible().length === 0) return;
    timer = schedule(() => { timer = null; void poll(); }, 2000);
  }
  async function poll() {
    if (!active || round) return;
    const current = {}; round = current;
    const ids = eligible().map((task) => task.id);
    emit({ polling: true });
    try {
      // Bound request concurrency; completed jobs are omitted from subsequent rounds.
      for (let offset = 0; offset < ids.length; offset += 4) {
        if (!active || round !== current) return;
        await Promise.all(ids.slice(offset, offset + 4).map(async (id) => {
          if (!eligible().some((task) => task.id === id)) return;
          await request(id, (signal) => options.loadTask(id, signal), (task) => {
            if (!valid(task) || task.id !== id) { loseIdentity(); return; }
            const errors = { ...snapshot.taskErrors }; delete errors[id];
            emit({ tasks: mergeTasks(snapshot.tasks, [task]), taskErrors: errors });
          }, (message) => {
            if (snapshot.tasks.some((task) => task.id === id && isPending(task))) emit({ taskErrors: { ...snapshot.taskErrors, [id]: message } });
          });
        }));
      }
    } finally {
      if (round === current) { round = null; emit({ polling: false }); schedulePoll(); }
    }
  }
  async function loadHistory() {
    if (!active) return;
    clearTimer();
    emit({ historyLoading: true });
    await request("history", options.loadHistory, (tasks) => {
      if (!tasks.every(valid)) { loseIdentity(); return; }
      emit({ tasks: mergeTasks(snapshot.tasks, tasks), historyLoaded: true, historyLoading: false, historyError: null, taskErrors: {} });
    }, (message) => emit({ historyLoading: false, historyError: message }));
    schedulePoll();
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start: () => { if (!active) { active = true; void loadHistory(); } },
    stop,
    refresh: () => {
      if (!active) return;
      clearTimer(); round = null;
      for (const key of requests.keys()) abort(key);
      emit({ polling: false }); void loadHistory();
    },
    accepted: (task: Task) => {
      if (!active) return;
      if (!valid(task)) { loseIdentity(); return; }
      emit({ tasks: mergeTasks(snapshot.tasks, [task]) });
      // Invalidate a history snapshot that may predate this POST, then fetch the newly committed list.
      void loadHistory();
    },
  };
}
