"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT) || 8080;
const PUBLIC_ROOT = path.resolve(__dirname);
const INVALID_PATH_CHARACTERS = /[\u0000-\u001f\u007f]/u;
const PUBLIC_ROOT_ENTRIES = new Set(["assets", "index.html", "quiz", "src", "vsl"]);

const MIME_TYPES = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webm": "video/webm",
  ".webp": "image/webp",
});

function sendText(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  response.end(body);
}

function parseRequestUrl(request) {
  try {
    return new URL(request.url, `http://${request.headers.host || "localhost"}`);
  } catch {
    return null;
  }
}

function resolvePublicPath(urlPathname) {
  let decodedPath;

  try {
    decodedPath = decodeURIComponent(urlPathname);
  } catch {
    return null;
  }

  if (INVALID_PATH_CHARACTERS.test(decodedPath)) {
    return null;
  }

  const pathSegments = decodedPath.split(/[\\/]+/u).filter(Boolean);
  if (pathSegments.some((segment) => segment.startsWith("."))) {
    return null;
  }

  if (pathSegments.length > 0 && !PUBLIC_ROOT_ENTRIES.has(pathSegments[0])) {
    return null;
  }

  const relativePath = decodedPath.replace(/^[/\\]+/, "");
  const absolutePath = path.resolve(PUBLIC_ROOT, relativePath);

  if (absolutePath !== PUBLIC_ROOT && !absolutePath.startsWith(`${PUBLIC_ROOT}${path.sep}`)) {
    return null;
  }

  return absolutePath;
}

function statPath(filePath, callback) {
  try {
    fs.stat(filePath, callback);
  } catch (error) {
    callback(error);
  }
}

function getCacheControl(extension) {
  if (extension === ".html") return "no-cache";
  if (extension === ".mp4" || extension === ".webm") {
    return "public, max-age=604800, immutable";
  }
  if ([".webp", ".png", ".jpg", ".jpeg", ".svg", ".ico"].includes(extension)) {
    return "public, max-age=604800";
  }
  return "public, max-age=3600, must-revalidate";
}

function parseRange(rangeHeader, size) {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader || "");
  if (!match) return null;

  let start;
  let end;

  if (match[1] === "" && match[2] !== "") {
    const suffixLength = Number(match[2]);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? size - 1 : Number(match[2]);
  }

  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    start >= size
  ) {
    return null;
  }

  return {
    start,
    end: Math.min(end, size - 1),
  };
}

function streamFile(request, response, filePath, stats) {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extension] || "application/octet-stream";
  const etag = `W/"${stats.size.toString(16)}-${Math.trunc(stats.mtimeMs).toString(16)}"`;
  const commonHeaders = {
    "Accept-Ranges": "bytes",
    "Cache-Control": getCacheControl(extension),
    "Content-Type": contentType,
    ETag: etag,
    "Last-Modified": stats.mtime.toUTCString(),
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
  };

  if (!request.headers.range && request.headers["if-none-match"] === etag) {
    response.writeHead(304, commonHeaders);
    response.end();
    return;
  }

  if (request.headers.range) {
    const range = parseRange(request.headers.range, stats.size);

    if (!range) {
      response.writeHead(416, {
        ...commonHeaders,
        "Content-Range": `bytes */${stats.size}`,
      });
      response.end();
      return;
    }

    const contentLength = range.end - range.start + 1;
    response.writeHead(206, {
      ...commonHeaders,
      "Content-Length": contentLength,
      "Content-Range": `bytes ${range.start}-${range.end}/${stats.size}`,
    });

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    fs.createReadStream(filePath, range).pipe(response);
    return;
  }

  response.writeHead(200, {
    ...commonHeaders,
    "Content-Length": stats.size,
  });

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer((request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    sendText(response, 405, "Método não permitido.");
    return;
  }

  const requestUrl = parseRequestUrl(request);
  if (!requestUrl) {
    sendText(response, 400, "Requisição inválida.");
    return;
  }

  const requestedPath = resolvePublicPath(requestUrl.pathname);
  if (!requestedPath) {
    sendText(response, 400, "Caminho inválido.");
    return;
  }

  statPath(requestedPath, (statError, requestedStats) => {
    if (statError) {
      sendText(response, 404, "Página não encontrada.");
      return;
    }

    if (requestedStats.isDirectory()) {
      if (!requestUrl.pathname.endsWith("/")) {
        response.writeHead(308, {
          Location: `${requestUrl.pathname}/${requestUrl.search}`,
          "Cache-Control": "no-store",
        });
        response.end();
        return;
      }

      const indexPath = path.join(requestedPath, "index.html");

      statPath(indexPath, (indexError, indexStats) => {
        if (indexError || !indexStats.isFile()) {
          sendText(response, 404, "Página não encontrada.");
          return;
        }

        streamFile(request, response, indexPath, indexStats);
      });
      return;
    }

    if (!requestedStats.isFile()) {
      sendText(response, 404, "Página não encontrada.");
      return;
    }

    streamFile(request, response, requestedPath, requestedStats);
  });
});

server.on("clientError", (_error, socket) => {
  socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});

server.listen(PORT, HOST, () => {
  console.log(`Protocolo Antiflacidez disponível em http://${HOST}:${PORT}`);
});
