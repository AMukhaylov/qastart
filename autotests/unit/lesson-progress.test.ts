import assert from "node:assert/strict";
import test from "node:test";
import {
  persistProgressWithRecovery,
  progressQueueKey,
  queuePendingProgressIds,
  readPendingProgressIds,
  removePendingProgressIds,
} from "../../src/lib/lesson-progress.ts";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

test("treats a timed-out response as success when the progress row was persisted", async () => {
  let writes = 0;
  const result = await persistProgressWithRecovery(
    async () => {
      writes += 1;
      return { error: new Error("response timed out") };
    },
    async () => ({ persisted: true }),
  );

  assert.deepEqual(result, { saved: true });
  assert.equal(writes, 1);
});

test("retries an idempotent progress write once after verification finds missing rows", async () => {
  let writes = 0;
  let verifications = 0;
  const result = await persistProgressWithRecovery(
    async () => {
      writes += 1;
      return writes === 1 ? { error: new Error("temporary network issue") } : { error: null };
    },
    async () => {
      verifications += 1;
      return { persisted: false };
    },
  );

  assert.deepEqual(result, { saved: true });
  assert.equal(writes, 2);
  assert.equal(verifications, 1);
});

test("reports failure after two failed writes and verification checks", async () => {
  let writes = 0;
  let verifications = 0;
  const result = await persistProgressWithRecovery(
    async () => {
      writes += 1;
      return { error: new Error("permission denied") };
    },
    async () => {
      verifications += 1;
      return { persisted: false };
    },
  );

  assert.equal(result.saved, false);
  assert.equal(writes, 2);
  assert.equal(verifications, 2);
});

test("keeps an idempotent per-user, per-lesson outbox and removes synced ids", () => {
  const storage = new MemoryStorage();
  const key = progressQueueKey("student-1", "lesson-12");

  queuePendingProgressIds(storage, key, ["block-a", "block-b"]);
  queuePendingProgressIds(storage, key, ["block-b", "block-c"]);
  assert.deepEqual(readPendingProgressIds(storage, key), ["block-a", "block-b", "block-c"]);

  removePendingProgressIds(storage, key, ["block-a", "block-c"]);
  assert.deepEqual(readPendingProgressIds(storage, key), ["block-b"]);
  removePendingProgressIds(storage, key, ["block-b"]);
  assert.deepEqual(readPendingProgressIds(storage, key), []);
  assert.notEqual(key, progressQueueKey("student-2", "lesson-12"));
});

test("ignores corrupted local progress queues instead of crashing lesson rendering", () => {
  const storage = new MemoryStorage();
  const key = progressQueueKey("student-1", "lesson-12");
  storage.setItem(key, "not valid JSON");

  assert.deepEqual(readPendingProgressIds(storage, key), []);
});
