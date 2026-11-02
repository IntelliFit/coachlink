import {
  isMotionJobGone,
  motionRestorePlan,
} from "@coachlink/core/src/motionEffectJobRestore";
import type { MotionEffectJobDto } from "@/app/api/toolbox/motion-effects/types";

export const PENDING_JOB_KEY = "jiaolian_motion_effect_pending_job";

const UPLOAD_LOCK = "jiaolian_motion_effect_upload";
const UPLOAD_HEARTBEAT_KEY = "jiaolian_motion_effect_upload_heartbeat";
const UPLOAD_HEARTBEAT_TTL_MS = 30000;
const POLL_INTERVAL_MS = 1800;
const MAX_POLL_WAIT_MS = 15000;
const OTHER_TAB_UPLOAD_WAIT_MS = 5000;
const POLL_NOTE_AFTER_FAILURES = 3;

export type PendingMotionJob = {
  jobId: string;
  /** 访客任务凭它查询；登录账号创建的任务没有 token。 */
  ownerToken: string;
  /** 创建任务的账号。旧页面存的记录没有这一项。 */
  userId: string;
};

export type MotionJobFollowResult =
  | { outcome: "done" | "ended"; job: MotionEffectJobDto }
  | { outcome: "unreleasable"; message: string }
  | { outcome: "released" | "forgotten" | "sign_in" | "other_account" | "stopped" };

export type MotionJobFollowDeps = {
  /** 页面离开后为 true，跟进随之停止，也不再动本地记录。 */
  isStale: () => boolean;
  onJob: (job: MotionEffectJobDto) => void;
  onRetrying: (failures: number) => void;
  getViewerId: () => Promise<string>;
  isUploadingElsewhere?: () => Promise<boolean>;
  sleep?: (ms: number) => Promise<void>;
};

class MotionApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** 响应确实来自我们的接口。网关报的 404 不代表任务没了。 */
    readonly fromApi: boolean,
  ) {
    super(message);
  }
}

export async function readApi<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new MotionApiError(
      payload?.message || `请求失败（${response.status}）`,
      response.status,
      Boolean(payload),
    );
  }
  return payload.data as T;
}

export function parsePendingJob(raw: string | null): PendingMotionJob | null {
  if (!raw) return null;
  let stored: { jobId?: unknown; ownerToken?: unknown; userId?: unknown } | null;
  try {
    stored = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!stored || typeof stored.jobId !== "string" || !stored.jobId) return null;
  return {
    jobId: stored.jobId,
    ownerToken: typeof stored.ownerToken === "string" ? stored.ownerToken : "",
    userId: typeof stored.userId === "string" ? stored.userId : "",
  };
}

/** 每个账号一条记录，访客和旧页面的记录用原来的 key。换账号生成新视频不会盖掉别人的任务。 */
export function pendingJobKey(userId: string) {
  return userId ? `${PENDING_JOB_KEY}:${userId}` : PENDING_JOB_KEY;
}

export function readPendingJob(userId: string) {
  try {
    return parsePendingJob(localStorage.getItem(pendingJobKey(userId)));
  } catch {
    return null;
  }
}

export function rememberPendingJob(pending: PendingMotionJob) {
  try {
    localStorage.setItem(pendingJobKey(pending.userId), JSON.stringify(pending));
  } catch {
    // 存不下只是刷新后找不回，不影响这次生成
  }
}

/** 只删指定任务：另一个标签页可能已经记下了更新的任务。 */
export function forgetPendingJob(pending: PendingMotionJob) {
  try {
    const key = pendingJobKey(pending.userId);
    if (parsePendingJob(localStorage.getItem(key))?.jobId === pending.jobId) {
      localStorage.removeItem(key);
    }
  } catch {
    // 删不掉时下次进入页面会再查一次，服务端会说明任务状态
  }
}

function readAnyAccountJob() {
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(`${PENDING_JOB_KEY}:`)) continue;
      const pending = parsePendingJob(localStorage.getItem(key));
      if (pending) return pending;
    }
  } catch {
    // 读不了本地存储就当没有记录
  }
  return null;
}

export function hasRememberedJob() {
  return Boolean(readPendingJob("") || readAnyAccountJob());
}

/** 查询失败时抛错，不能当成没登录：否则一次断网就会让账号任务看起来像别人的。 */
export async function fetchViewerId() {
  const response = await fetch("/api/auth/session", { cache: "no-store" });
  if (!response.ok) throw new Error(`请求失败（${response.status}）`);
  const session = await response.json();
  return session?.user?.id ? String(session.user.id) : "";
}

function retryWait(failures: number) {
  return Math.min(POLL_INTERVAL_MS * 2 ** failures, MAX_POLL_WAIT_MS);
}

function defaultSleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * 进入页面时决定接上哪个任务：优先当前账号的，其次这台设备的访客任务。
 * 别的账号的记录不查也不动；没登录时只提示登录，查了服务端也只会回 404。
 */
export async function findRememberedJob(deps: {
  isStale: () => boolean;
  getViewerId: () => Promise<string>;
  onRetrying: (failures: number) => void;
  sleep?: (ms: number) => Promise<void>;
}) {
  const sleep = deps.sleep ?? defaultSleep;
  let failures = 0;
  while (!deps.isStale()) {
    try {
      const viewerId = await deps.getViewerId();
      return {
        pending: (viewerId ? readPendingJob(viewerId) : null) || readPendingJob(""),
        signInJob: viewerId ? null : readAnyAccountJob(),
      };
    } catch {
      failures += 1;
      deps.onRetrying(failures);
      await sleep(retryWait(failures));
    }
  }
  return { pending: null, signInJob: null };
}

/**
 * 服务端对“没登录”“换了账号”和“任务真没了”都回 404，账号任务要先看是谁在问，
 * 否则登录失效一次就会把还在生成的任务忘掉。
 */
export function missingJobMeaning(pending: PendingMotionJob, viewerId: string) {
  if (pending.ownerToken) return "gone" as const;
  if (!viewerId) return "sign_in" as const;
  if (pending.userId && pending.userId !== viewerId) return "other_account" as const;
  return "gone" as const;
}

/** 进度条前 35% 留给上传，这里算的是服务端生成的部分。 */
export function motionJobProgress(job: Pick<MotionEffectJobDto, "status" | "progress">) {
  if (job.status === "done") return 100;
  return Math.round(35 + Math.max(0, Math.min(65, job.progress * 0.65)));
}

export function isMotionJobRunning(job: Pick<MotionEffectJobDto, "status">) {
  return job.status === "queued" || job.status === "processing";
}

export function motionJobDetail(job: MotionEffectJobDto) {
  if (isMotionJobRunning(job)) {
    const ahead = job.queueInfo?.jobsAhead;
    const stage = job.status === "queued" && ahead ? `已进入队列，前方还有 ${ahead} 个任务。` : "视频正在生成。";
    return `${stage}可以离开本页，回来后会接着显示进度。`;
  }
  if (job.status === "done") return "成片最多保留 24 小时，请及时下载。";
  if (job.status === "expired") return "原视频和成片最多保留 24 小时，请重新上传。";
  return job.errorMessage || "特效视频生成失败，请重新上传。";
}

export function motionPollNote(failures: number) {
  return failures >= POLL_NOTE_AFTER_FAILURES ? "网络不稳定，正在继续查询进度，任务不受影响。" : "";
}

/** 本页正在生成的视频结束时，状态栏要说的话。空字符串表示不用说。 */
export function motionFollowMessage(result: MotionJobFollowResult) {
  switch (result.outcome) {
    case "done":
      return "MP4 已生成并保留原音频，可以直接下载。";
    case "ended":
      return motionJobDetail(result.job);
    case "unreleasable":
      return result.message;
    case "forgotten":
      return "这个任务已不存在，请重新生成。";
    case "other_account":
      return "当前账号看不到这个任务，切回原账号后可以继续查看。";
    default:
      return "";
  }
}

function webLocks() {
  return typeof navigator === "undefined" ? undefined : navigator.locks;
}

/** 没有 Web Locks 的旧浏览器靠上传进度写心跳，页面关掉后心跳过期就算没人在传。 */
export function beatUploadHeartbeat() {
  if (webLocks()) return;
  try {
    localStorage.setItem(UPLOAD_HEARTBEAT_KEY, String(Date.now()));
  } catch {
    // 写不了心跳只影响多标签页判断
  }
}

function clearUploadHeartbeat() {
  try {
    localStorage.removeItem(UPLOAD_HEARTBEAT_KEY);
  } catch {
    // 留下的心跳会自己过期
  }
}

function hasFreshUploadHeartbeat() {
  try {
    const beat = Number(localStorage.getItem(UPLOAD_HEARTBEAT_KEY));
    return beat > 0 && Date.now() - beat < UPLOAD_HEARTBEAT_TTL_MS;
  } catch {
    return false;
  }
}

/** 上传全程持有这把锁，页面关闭时浏览器会自动释放。 */
export async function isUploadingElsewhere() {
  const locks = webLocks();
  if (!locks) return hasFreshUploadHeartbeat();
  return locks.request(UPLOAD_LOCK, { ifAvailable: true }, (lock) => lock === null);
}

export async function holdUploadLock<T>(work: () => Promise<T>): Promise<T> {
  const locks = webLocks();
  if (locks) {
    return locks.request(UPLOAD_LOCK, { ifAvailable: true }, (lock) => {
      if (!lock) throw new Error("另一个页面正在上传视频，请等它传完");
      return work();
    }) as Promise<T>;
  }
  beatUploadHeartbeat();
  try {
    return await work();
  } finally {
    clearUploadHeartbeat();
  }
}

function jobRequestHeaders(pending: PendingMotionJob): Record<string, string> {
  return pending.ownerToken ? { "x-motion-owner-token": pending.ownerToken } : {};
}

function fetchMotionJob(pending: PendingMotionJob) {
  return fetch(`/api/toolbox/motion-effects/jobs/${pending.jobId}`, {
    cache: "no-store",
    headers: jobRequestHeaders(pending),
  }).then((response) => readApi<MotionEffectJobDto>(response));
}

function cancelMotionJob(pending: PendingMotionJob) {
  return fetch(`/api/toolbox/motion-effects/jobs/${pending.jobId}/cancel`, {
    method: "POST",
    headers: jobRequestHeaders(pending),
  }).then((response) => readApi<MotionEffectJobDto>(response));
}

/**
 * 跟进本地记下的任务直到有结果。请求失败不等于任务失败：任务还在服务端，这里退避后继续查，
 * 只有服务端确认任务不存在才删记录。规则和小程序共用 motionRestorePlan。
 */
export async function followMotionJob(
  pending: PendingMotionJob,
  deps: MotionJobFollowDeps,
): Promise<MotionJobFollowResult> {
  const sleep = deps.sleep ?? defaultSleep;
  const uploadingElsewhere = deps.isUploadingElsewhere ?? isUploadingElsewhere;
  let failures = 0;

  while (!deps.isStale()) {
    try {
      const job = await fetchMotionJob(pending);
      if (deps.isStale()) break;
      failures = 0;
      const plan = motionRestorePlan(job, false);

      if (plan === "poll") {
        deps.onJob(job);
        await sleep(POLL_INTERVAL_MS);
        continue;
      }
      if (plan === "done") {
        deps.onJob(job);
        return { outcome: "done", job };
      }
      if (plan === "release") {
        // 另一个标签页还在传时不能取消，等它传完或者关掉
        if (await uploadingElsewhere()) {
          await sleep(OTHER_TAB_UPLOAD_WAIT_MS);
          continue;
        }
        if (deps.isStale()) break;
        let afterCancel: MotionEffectJobDto;
        try {
          afterCancel = await cancelMotionJob(pending);
        } catch (error) {
          if (!(error instanceof MotionApiError) || error.status !== 409) throw error;
          forgetPendingJob(pending);
          return { outcome: "unreleasable", message: error.message };
        }
        // 查询之后任务可能刚好入队，取消接口对它什么也不改，还要接着跟进
        if (afterCancel.status !== "failed" && afterCancel.status !== "expired") {
          await sleep(POLL_INTERVAL_MS);
          continue;
        }
        forgetPendingJob(pending);
        return { outcome: "released" };
      }

      forgetPendingJob(pending);
      if (plan === "notice") {
        deps.onJob(job);
        return { outcome: "ended", job };
      }
      return { outcome: "forgotten" };
    } catch (error) {
      if (deps.isStale()) break;
      if (error instanceof MotionApiError && error.fromApi && isMotionJobGone(error)) {
        const viewerId = await deps.getViewerId().catch(() => null);
        if (deps.isStale()) break;
        if (viewerId !== null) {
          const meaning = missingJobMeaning(pending, viewerId);
          if (meaning !== "gone") return { outcome: meaning };
          forgetPendingJob(pending);
          return { outcome: "forgotten" };
        }
      }
      failures += 1;
      deps.onRetrying(failures);
      await sleep(retryWait(failures));
    }
  }
  return { outcome: "stopped" };
}
