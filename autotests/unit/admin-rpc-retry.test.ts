import assert from "node:assert/strict";
import test from "node:test";
import { createAdminRpcRetryFetch } from "../../src/lib/retry-admin-rpc.ts";

test("retries a transient gateway response for the idempotent lesson save RPC", async () => {
  let calls = 0;
  const retryFetch = createAdminRpcRetryFetch(
    async () => {
      calls += 1;
      return calls === 1
        ? new Response("<html>502 Bad Gateway</html>", { status: 502 })
        : new Response('"lesson-id"', { status: 200 });
    },
    async () => undefined,
  );

  const response = await retryFetch(
    "https://project.supabase.co/rest/v1/rpc/admin_save_lesson_package",
    { method: "POST", body: "{}" },
  );

  assert.equal(response.status, 200);
  assert.equal(calls, 2);
});

test("does not retry a non-idempotent table insert", async () => {
  let calls = 0;
  const retryFetch = createAdminRpcRetryFetch(
    async () => {
      calls += 1;
      return new Response("502 Bad Gateway", { status: 502 });
    },
    async () => undefined,
  );

  const response = await retryFetch("https://project.supabase.co/rest/v1/lessons", {
    method: "POST",
    body: "{}",
  });

  assert.equal(response.status, 502);
  assert.equal(calls, 1);
});

test("caps idempotent RPC retries at three total attempts", async () => {
  let calls = 0;
  const retryFetch = createAdminRpcRetryFetch(
    async () => {
      calls += 1;
      return new Response("502 Bad Gateway", { status: 502 });
    },
    async () => undefined,
  );

  const response = await retryFetch(
    "https://project.supabase.co/rest/v1/rpc/admin_import_lesson_package_once",
    { method: "POST", body: "{}" },
  );

  assert.equal(response.status, 502);
  assert.equal(calls, 3);
});
