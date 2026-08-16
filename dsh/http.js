// 最小 HTTP 工具：JSON 序列化、变更接口的同源校验、带大小上限的 JSON 体读取。
// 移植自 dsh-market 的 lib/http.js。
import { ApiError } from "./db.js";

/** 写 JSON 响应，no-store 缓存。 */
export function sendJson(response, status, payload) {
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

/**
 * 同源校验：请求的 Origin 与 Host 必须一致（POST/PATCH/DELETE 必做）。
 * 无 Origin 头（CLI / curl / 同源页面直接 fetch）放行；有 Origin 则必须匹配 Host。
 */
export function sameOrigin(request) {
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (origin === undefined || host === undefined) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** 读取并解析 JSON 请求体，超过 1 MiB 拒绝。 */
export async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 1024 * 1024) throw new ApiError(413, "BODY_TOO_LARGE", "request body too large");
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ApiError(400, "INVALID_JSON", "request body is not valid JSON");
  }
}

/** 从查询字符串解析 int（带默认值）。 */
export function intQuery(request, key, fallback) {
  const value = new URL(request.url, "http://localhost").searchParams.get(key);
  if (value === null) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}
