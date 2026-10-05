const retryableAdminRpcPaths = new Set([
  "/rest/v1/rpc/admin_save_lesson_package",
  "/rest/v1/rpc/admin_import_lesson_package_once",
]);

export function createAdminRpcRetryFetch(
  fetchImpl: typeof fetch = fetch,
  wait: (milliseconds: number) => Promise<void> = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
) {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const path = new URL(request.url).pathname;
    if (!retryableAdminRpcPaths.has(path)) return fetchImpl(request);

    for (let attempt = 0; ; attempt += 1) {
      const response = await fetchImpl(request.clone());
      if (response.status !== 502 || attempt >= 2) return response;

      await response.body?.cancel();
      await wait(250 * 2 ** attempt);
    }
  };
}
