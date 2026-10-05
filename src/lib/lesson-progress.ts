export type ProgressWriteResult = { error: unknown | null };
export type ProgressVerificationResult = { persisted: boolean; error?: unknown | null };
export type ProgressStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function progressQueueKey(userId: string, lessonId: string) {
  return `qastart:pending-lesson-progress:v1:${userId}:${lessonId}`;
}

export function readPendingProgressIds(storage: ProgressStorage, key: string): string[] {
  try {
    const value: unknown = JSON.parse(storage.getItem(key) ?? "[]");
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(value.filter((id): id is string => typeof id === "string")));
  } catch {
    return [];
  }
}

export function queuePendingProgressIds(storage: ProgressStorage, key: string, ids: string[]) {
  const queued = new Set(readPendingProgressIds(storage, key));
  ids.forEach((id) => queued.add(id));
  try {
    storage.setItem(key, JSON.stringify([...queued]));
  } catch {
    // The online request still gets a chance if browser storage is unavailable.
  }
}

export function removePendingProgressIds(storage: ProgressStorage, key: string, ids: string[]) {
  const removed = new Set(ids);
  const queued = readPendingProgressIds(storage, key).filter((id) => !removed.has(id));
  try {
    if (queued.length === 0) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(queued));
  } catch {
    // A stale queue is safe: progress upserts are idempotent and will be retried.
  }
}

export async function runProgressRequest<T>(
  request: (signal: AbortSignal) => PromiseLike<T>,
  timeoutMs = 5000,
): Promise<T> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(() => request(controller.signal)),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          controller.abort();
          reject(new Error("Превышено время сохранения прогресса"));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

/**
 * Progress writes are idempotent upserts. When the response is lost or times out,
 * verify the persisted rows and retry once before reporting a failure to the learner.
 */
export async function persistProgressWithRecovery(
  write: () => Promise<ProgressWriteResult>,
  verify: () => Promise<ProgressVerificationResult>,
): Promise<{ saved: true } | { saved: false; error: unknown }> {
  let lastError: unknown = new Error("Не удалось подтвердить сохранение прогресса");

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await write();
      if (!result.error) return { saved: true };
      lastError = result.error;
    } catch (error) {
      lastError = error;
    }

    try {
      const verification = await verify();
      if (verification.persisted) return { saved: true };
      if (verification.error) lastError = verification.error;
    } catch (error) {
      lastError = error;
    }
  }

  return { saved: false, error: lastError };
}
