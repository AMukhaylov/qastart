import http from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import app from "./dist/server/server.js";

const port = Number(process.env.PORT || 3000);
const clientDir = path.resolve("dist/client");
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
};

async function serveStatic(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split("?")[0]);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }
  const safePath = path.normalize(decoded).replace(/^([/\\])+/, "");
  const filePath = path.join(clientDir, safePath);

  if (!filePath.startsWith(clientDir) || !existsSync(filePath)) return null;
  if (!statSync(filePath).isFile()) return null;

  const body = await readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();

  return new Response(body, {
    headers: {
      "content-type": contentTypes[ext] || "application/octet-stream",
      "cache-control": decoded.startsWith("/assets/")
        ? "public, max-age=31536000, immutable"
        : "public, max-age=300",
    },
  });
}

http
  .createServer(async (req, res) => {
    try {
      const origin = `http://${req.headers.host || `127.0.0.1:${port}`}`;
      const url = new URL(req.url || "/", origin);
      let response = await serveStatic(url.pathname);

      if (!response) {
        const body = req.method === "GET" || req.method === "HEAD" ? undefined : req;
        const headers = new Headers();

        for (const [key, value] of Object.entries(req.headers)) {
          if (Array.isArray(value)) headers.set(key, value.join(", "));
          else if (value !== undefined) headers.set(key, value);
        }

        const request = new Request(url.href, {
          method: req.method,
          headers,
          body,
          duplex: "half",
        });

        response = await app.fetch(request, process.env, {});
      }

      res.writeHead(response.status, Object.fromEntries(response.headers));
      if (req.method === "HEAD") return res.end();

      const buffer = Buffer.from(await response.arrayBuffer());
      res.end(buffer);
    } catch (error) {
      console.error(error);
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end("Internal Server Error");
    }
  })
  .listen(port, "127.0.0.1", () => {
    console.log(`qastart listening on http://127.0.0.1:${port}`);
  });
