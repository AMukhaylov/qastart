import { useEffect, useState } from "react";

export type DiagEntry = {
  id: string;
  label: string;
  startedAt: number;
  durationMs: number;
  attempts: number;
  status: "ok" | "error";
  error?: string;
  code?: string;
};

const MAX_ENTRIES = 50;
let entries: DiagEntry[] = [];
const listeners = new Set<(e: DiagEntry[]) => void>();

function emit() {
  for (const l of listeners) l(entries);
}

export function pushDiag(entry: DiagEntry) {
  entries = [entry, ...entries].slice(0, MAX_ENTRIES);
  emit();
}

export function clearDiag() {
  entries = [];
  emit();
}

export function useDiagnostics() {
  const [list, setList] = useState<DiagEntry[]>(entries);
  useEffect(() => {
    listeners.add(setList);
    return () => {
      listeners.delete(setList);
    };
  }, []);
  return list;
}

function isTransient(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string; status?: number };
  if (e.code === "PGRST002") return true;
  if (e.status === 503 || e.status === 502 || e.status === 504) return true;
  const msg = (e.message ?? "").toLowerCase();
  return (
    msg.includes("schema cache") ||
    msg.includes("retrying") ||
    msg.includes("timed out") ||
    msg.includes("fetch")
  );
}

function wait(ms: number) {
  return new Promise((r) => window.setTimeout(r, ms));
}

export type SupabaseLike<T> = PromiseLike<{
  data: T | null;
  error: { code?: string; message?: string } | null;
}>;

export async function withRetry<T>(
  label: string,
  factory: () => SupabaseLike<T>,
  opts: { retries?: number; baseDelay?: number; timeoutMs?: number } = {},
): Promise<{ data: T | null; error: { code?: string; message?: string } | null }> {
  const retries = opts.retries ?? 5;
  const baseDelay = opts.baseDelay ?? 600;
  const timeoutMs = opts.timeoutMs ?? 9000;
  const startedAt = Date.now();
  let attempts = 0;
  let lastError: { code?: string; message?: string } | null = null;

  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    attempts = attempt;
    try {
      const result = await Promise.race([
        Promise.resolve(factory()),
        new Promise<never>((_, reject) =>
          window.setTimeout(
            () => reject(Object.assign(new Error("Request timed out"), { code: "TIMEOUT" })),
            timeoutMs,
          ),
        ),
      ]);
      if (result.error) {
        lastError = result.error;
        if (isTransient(result.error) && attempt <= retries) {
          await wait(baseDelay * attempt);
          continue;
        }
        pushDiag({
          id: `${startedAt}-${label}`,
          label,
          startedAt,
          durationMs: Date.now() - startedAt,
          attempts,
          status: "error",
          error: result.error.message,
          code: result.error.code,
        });
        return result;
      }
      pushDiag({
        id: `${startedAt}-${label}`,
        label,
        startedAt,
        durationMs: Date.now() - startedAt,
        attempts,
        status: "ok",
      });
      return result;
    } catch (err) {
      const e = err as { code?: string; message?: string };
      lastError = { code: e.code, message: e.message };
      if (isTransient(e) && attempt <= retries) {
        await wait(baseDelay * attempt);
        continue;
      }
      break;
    }
  }

  pushDiag({
    id: `${startedAt}-${label}`,
    label,
    startedAt,
    durationMs: Date.now() - startedAt,
    attempts,
    status: "error",
    error: lastError?.message ?? "Unknown error",
    code: lastError?.code,
  });
  return { data: null, error: lastError ?? { message: "Unknown error" } };
}
