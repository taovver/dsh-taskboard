// 看板 API 客户端：裸 fetch 打宿主 /taskboard/* 路由。
const BASE = "/taskboard/api";

async function request(method, path, body) {
  const options = { method, headers: {} };
  if (body !== undefined) {
    options.headers["content-type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, options);
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error?.message || `HTTP ${res.status}`);
    err.code = data?.error?.code;
    err.details = data?.error?.details;
    throw err;
  }
  return data;
}

export function listProjects() {
  return request("GET", "/projects");
}

export function listTasks(projectId, archived = "false") {
  return request("GET", `/tasks?project=${encodeURIComponent(projectId)}&archived=${archived}`);
}

export function getTask(id) {
  return request("GET", `/tasks/${encodeURIComponent(id)}`);
}

export function createTask(body) {
  return request("POST", "/tasks", body);
}

export function updateTask(id, body) {
  return request("PATCH", `/tasks/${encodeURIComponent(id)}`, body);
}

export function moveTask(id, body) {
  return request("POST", `/tasks/${encodeURIComponent(id)}/move`, body);
}

export function archiveTask(id, version) {
  return request("POST", `/tasks/${encodeURIComponent(id)}/archive`, { version });
}

export function restoreTask(id, version) {
  return request("POST", `/tasks/${encodeURIComponent(id)}/restore`, { version });
}

export function listComments(taskId) {
  return request("GET", `/tasks/${encodeURIComponent(taskId)}/comments`);
}

export function addComment(taskId, body) {
  return request("POST", `/tasks/${encodeURIComponent(taskId)}/comments`, body);
}

// 会话归属（UI 侧）：槽位组件自带 sessionId，写操作带上它。
export function sessionAttribution(sessionId, sessions) {
  if (!sessionId) return {};
  const title = sessions?.title?.(sessionId) ?? null;
  return { sessionId, sessionTitle: title ?? undefined };
}
