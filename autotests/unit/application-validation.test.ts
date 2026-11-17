import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  APPLICATION_STATUSES,
  isValidApplicationContact,
  normalizeApplicationContact,
} from "../../src/lib/application-validation.ts";

test("telegram handles normalize URLs and @ prefixes into one duplicate key", () => {
  assert.equal(normalizeApplicationContact("telegram", "@QaStart_1"), "telegram:qastart_1");
  assert.equal(
    normalizeApplicationContact("telegram", "https://t.me/QaStart_1"),
    "telegram:qastart_1",
  );
  assert.equal(isValidApplicationContact("telegram", "@QaStart_1"), true);
  assert.equal(isValidApplicationContact("telegram", "abc"), false);
});

test("VK handles and profile URLs normalize and validate", () => {
  assert.equal(normalizeApplicationContact("vk", "https://vk.com/QA.Start/"), "vk:qa.start");
  assert.equal(isValidApplicationContact("vk", "vk.com/qa.start"), true);
  assert.equal(isValidApplicationContact("vk", "<script>"), false);
});

test("application workflow allows only the configured statuses", () => {
  assert.deepEqual(APPLICATION_STATUSES, ["new", "contacted", "confirmed", "declined"]);
});

test("application data and status mutation are inaccessible to public Supabase roles", () => {
  const migration = readFileSync(
    new URL("../../supabase/migrations/20261116165438_qastart_applications.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /alter table public\.course_applications enable row level security/i);
  assert.match(
    migration,
    /revoke all on public\.course_applications from public, anon, authenticated/i,
  );
  assert.match(
    migration,
    /revoke all on function public\.reserve_course_application_attempt\(text\) from public, anon, authenticated/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.reserve_course_application_attempt\(text\) to service_role/i,
  );
});

test("application deletion requires admin authorization and a UUID", () => {
  const server = readFileSync(
    new URL("../../src/server/applications.functions.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    server,
    /const deleteInput = adminInput\.extend\(\{ id: z\.string\(\)\.uuid\(\) \}\)/,
  );
  assert.match(server, /export const deleteCourseApplication = createServerFn/);
  assert.match(
    server,
    /deleteCourseApplication[\s\S]*?await assertApplicationAdmin\(data\.accessToken\)/,
  );
  assert.match(server, /delete\(\)[\s\S]*?\.eq\("id", data\.id\)/);
});

test("new applications create realtime notifications for admins", () => {
  const server = readFileSync(
    new URL("../../src/server/notifications.server.ts", import.meta.url),
    "utf8",
  );
  assert.match(server, /export async function notifyAdminsCourseApplication/);
  assert.match(server, /\.eq\("role", "admin"\)/);
  assert.match(server, /type: "course_application_submitted"/);
  assert.match(server, /title: "Новая заявка на Поток 0"/);
  assert.match(server, /link: "\/admin\/applications"/);
  assert.match(server, /course_application:\$\{application\.id\}:admin:\$\{admin\.user_id\}/);

  const submission = readFileSync(
    new URL("../../src/server/applications.functions.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    submission,
    /await notifyAdminsCourseApplication\(\{ id: application\.id, name: data\.name \}\)/,
  );
});
