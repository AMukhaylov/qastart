import { performance } from "node:perf_hooks";

const baseUrl = new URL(process.env.LOCAL_LOAD_BASE_URL ?? "http://127.0.0.1:4173");
const allowedHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
if (!allowedHosts.has(baseUrl.hostname)) {
  throw new Error("Load smoke is localhost-only; remote and production hosts are refused.");
}

const requestCount = Number(process.env.LOCAL_LOAD_REQUESTS ?? 500);
const concurrency = Number(process.env.LOCAL_LOAD_CONCURRENCY ?? 20);
if (!Number.isInteger(requestCount) || requestCount < 1 || requestCount > 1000) {
  throw new Error("LOCAL_LOAD_REQUESTS must be an integer from 1 to 1000.");
}
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 25) {
  throw new Error("LOCAL_LOAD_CONCURRENCY must be an integer from 1 to 25.");
}

const paths = ["/", "/auth", "/privacy", "/lessons/1"];
const samples = new Map(paths.map((path) => [path, []]));
let errors = 0;
let next = 0;

for (const path of paths) {
  const response = await fetch(new URL(path, baseUrl), { headers: { accept: "text/html" } });
  await response.arrayBuffer();
  if (!response.ok) throw new Error(`Warm-up failed for ${path}: HTTP ${response.status}`);
}

const startedAt = performance.now();

await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (true) {
      const requestIndex = next++;
      if (requestIndex >= requestCount) return;

      const path = paths[requestIndex % paths.length];
      const requestStartedAt = performance.now();
      try {
        const response = await fetch(new URL(path, baseUrl), {
          headers: { accept: "text/html" },
        });
        const body = await response.arrayBuffer();
        if (!response.ok) errors++;
        samples.get(path).push({
          ms: performance.now() - requestStartedAt,
          bytes: body.byteLength,
          status: response.status,
        });
      } catch {
        errors++;
        samples.get(path).push({
          ms: performance.now() - requestStartedAt,
          bytes: 0,
          status: 0,
        });
      }
    }
  }),
);

const elapsedMs = performance.now() - startedAt;
for (const path of paths) {
  const rows = samples.get(path);
  const sorted = rows.map((row) => row.ms).sort((left, right) => left - right);
  const percentile = (value) =>
    sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * value) - 1)] ?? 0;
  console.log(
    JSON.stringify({
      path,
      requests: rows.length,
      p50_ms: Math.round(percentile(0.5) * 10) / 10,
      p95_ms: Math.round(percentile(0.95) * 10) / 10,
      p99_ms: Math.round(percentile(0.99) * 10) / 10,
      average_bytes: Math.round(rows.reduce((sum, row) => sum + row.bytes, 0) / rows.length),
      non_200: rows.filter((row) => row.status !== 200).length,
    }),
  );
}

console.log(
  JSON.stringify({
    base: baseUrl.origin,
    requests: requestCount,
    concurrency,
    warmup_per_path: 1,
    elapsed_seconds: Math.round((elapsedMs / 1000) * 100) / 100,
    throughput_rps: Math.round(((requestCount * 1000) / elapsedMs) * 10) / 10,
    errors,
  }),
);

if (errors > 0) process.exitCode = 1;
