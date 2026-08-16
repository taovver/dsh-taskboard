// /taskboard/* HTTP 路由：挂在 dsh 的 webServer 上（prefix），内部按 method+pathname 分发。
// 语义与字段命名移植自 Codex Taskboard server/app.mjs，写操作带乐观锁 version。
import { sendJson, sameOrigin, readJsonBody } from "./http.js";
import { ApiError } from "./db.js";
import { isTaskStatus, isTaskPriority, TASK_STATUSES, TASK_PRIORITIES } from "./domain.js";

function pathname(request) {
  return new URL(request.url, "http://localhost").pathname;
}

function stringField(value, label, { required = false, maxLength = 256 } = {}) {
  if (value === undefined) {
    if (required) throw new ApiError(400, "INVALID_FIELD", `${label} is required`);
    return undefined;
  }
  if (typeof value !== "string") throw new ApiError(400, "INVALID_FIELD", `${label} must be a string`);
  if (value.length > maxLength) throw new ApiError(400, "INVALID_FIELD", `${label} exceeds ${maxLength} characters`);
  return value;
}

function parseVersion(value) {
  if (value === undefined) throw new ApiError(400, "INVALID_FIELD", "version is required");
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new ApiError(400, "INVALID_FIELD", "version must be a positive integer");
  return parsed;
}

function parseStatus(value) {
  if (value === undefined) return undefined;
  if (!isTaskStatus(value)) {
    throw new ApiError(400, "INVALID_FIELD", `status must be one of ${TASK_STATUSES.join(", ")}`);
  }
  return value;
}

function parsePriority(value) {
  if (value === undefined) return undefined;
  if (!isTaskPriority(value)) {
    throw new ApiError(400, "INVALID_FIELD", `priority must be one of ${TASK_PRIORITIES.join(", ")}`);
  }
  return value;
}

function parseLabels(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((label) => typeof label !== "string")) {
    throw new ApiError(400, "INVALID_FIELD", "labels must be an array of strings");
  }
  return value;
}

// UI/CLI 侧的 actor：来自请求头；缺省本地用户。
function actorFromRequest(request) {
  const id = request.headers["x-taskboard-user-id"];
  const name = request.headers["x-taskboard-user-name"];
  const avatarUrl = request.headers["x-taskboard-user-avatar"] ?? null;
  if (id === undefined || name === undefined) {
    return { type: "user", id: "local-user", name: "本地用户", avatarUrl: null };
  }
  return {
    type: "user",
    id: String(id).slice(0, 96),
    name: decodeURIComponentSafe(String(name)).slice(0, 120),
    avatarUrl: typeof avatarUrl === "string" ? avatarUrl.slice(0, 2048) : null,
  };
}

function decodeURIComponentSafe(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseSession(body) {
  const id = stringField(body.sessionId, "sessionId", { maxLength: 256 });
  const title = stringField(body.sessionTitle, "sessionTitle", { maxLength: 200 });
  if (id === undefined) return undefined;
  return { id, title: title ?? null };
}

function wrap(fn) {
  return (value) => ({ [fn]: value });
}

/**
 * 挂载全部看板路由。返回 disposer 数组（index.js 里的 ctx.effect 清理用）。
 */
export function mountTaskboardRoutes(host, db, events, sessions) {
  const disposers = [];
  disposers.push(
    host.webServer.register({
      name: "taskboard-api",
      kind: "prefix",
      path: "/taskboard",
      handler: async (request, response) => {
        try {
          await dispatch(request, response, db, events, sessions);
        } catch (error) {
          if (error instanceof ApiError) {
            sendJson(response, error.status, { error: { code: error.code, message: error.message, details: error.details } });
          } else {
            console.error("[taskboard] route error:", error);
            if (!response.headersSent) sendJson(response, 500, { error: { code: "INTERNAL", message: String(error?.message ?? error) } });
          }
        }
      },
    }),
  );
  return disposers;
}

async function dispatch(request, response, db, events, sessions) {
  const method = request.method;
  const path = pathname(request);
  const query = new URL(request.url, "http://localhost").searchParams;

  // ---- SSE 事件流 ----
  if (method === "GET" && path === "/taskboard/api/events") {
    events.connect(request, response);
    return;
  }

  // ---- 健康探针 ----
  if (method === "GET" && path === "/taskboard/health") {
    sendJson(response, 200, { status: "ok", plugin: "dsh-taskboard" });
    return;
  }

  // ---- projects ----
  if (path === "/taskboard/api/projects") {
    if (method === "GET") {
      sendJson(response, 200, { projects: db.listProjects() });
      return;
    }
    if (method === "POST") {
      assertSameOrigin(request);
      const body = await readJsonBody(request);
      const id = stringField(body.id, "id", { maxLength: 64 }) ?? slugify(stringField(body.name, "name", { required: true, maxLength: 120 }));
      const project = db.createProject({
        id,
        name: body.name,
        workspacePath: stringField(body.workspacePath, "workspacePath", { maxLength: 1024 }),
      });
      events.emit("project.created", { project });
      sendJson(response, 200, { project });
      return;
    }
  }

  // ---- tasks 集合 ----
  if (path === "/taskboard/api/tasks") {
    if (method === "GET") {
      const projectRaw = query.get("project");
      const statusRaw = query.get("status");
      const archivedRaw = query.get("archived");
      const filters = {
        projectId: projectRaw === null ? undefined : stringField(projectRaw, "project", { maxLength: 64 }),
        status: statusRaw === null ? undefined : stringField(statusRaw, "status", { maxLength: 32 }),
        archived: archivedRaw === null ? "false" : stringField(archivedRaw, "archived", { maxLength: 16 }),
      };
      sendJson(response, 200, { tasks: db.listTasks(filters) });
      return;
    }
    if (method === "POST") {
      assertSameOrigin(request);
      const body = await readJsonBody(request);
      const actor = actorFromRequest(request);
      const task = db.createTask({
        projectId: stringField(body.projectId, "projectId", { required: true, maxLength: 64 }),
        title: stringField(body.title, "title", { required: true, maxLength: 300 }),
        description: stringField(body.description, "description", { maxLength: 10000 }),
        status: parseStatus(body.status) ?? "backlog",
        priority: parsePriority(body.priority) ?? "none",
        labels: parseLabels(body.labels) ?? [],
        session: parseSession(body),
        actor,
      });
      events.emit("task.created", { task });
      sendJson(response, 200, { task });
      return;
    }
  }

  // ---- tasks/:id ----
  const taskMatch = path.match(/^\/taskboard\/api\/tasks\/([^/]+)$/);
  if (taskMatch) {
    const id = decodeURIComponent(taskMatch[1]);
    if (method === "GET") {
      const task = db.getTask(id);
      if (!task) throw new ApiError(404, "TASK_NOT_FOUND", `Task '${id}' does not exist`);
      sendJson(response, 200, { task });
      return;
    }
    if (method === "PATCH") {
      assertSameOrigin(request);
      const body = await readJsonBody(request);
      const version = parseVersion(body.version);
      const changes = {};
      if (body.changes && typeof body.changes === "object") {
        for (const key of ["title", "description", "status", "priority", "labels"]) {
          if (Object.hasOwn(body.changes, key)) changes[key] = body.changes[key];
        }
      }
      if (Object.hasOwn(changes, "status")) changes.status = parseStatus(changes.status);
      if (Object.hasOwn(changes, "priority")) changes.priority = parsePriority(changes.priority);
      if (Object.hasOwn(changes, "labels")) changes.labels = parseLabels(changes.labels);
      const task = db.updateTask(id, version, changes, parseSession(body));
      events.emit("task.updated", { task });
      sendJson(response, 200, { task });
      return;
    }
  }

  // ---- tasks/:id/move ----
  const moveMatch = path.match(/^\/taskboard\/api\/tasks\/([^/]+)\/move$/);
  if (moveMatch && method === "POST") {
    assertSameOrigin(request);
    const body = await readJsonBody(request);
    const task = db.moveTask(
      decodeURIComponent(moveMatch[1]),
      parseVersion(body.version),
      parseStatus(body.status),
      body.sortOrder === undefined ? undefined : Number(body.sortOrder),
      parseSession(body),
    );
    events.emit("task.moved", { task });
    sendJson(response, 200, { task });
    return;
  }

  // ---- tasks/:id/archive|restore ----
  const archiveMatch = path.match(/^\/taskboard\/api\/tasks\/([^/]+)\/(archive|restore)$/);
  if (archiveMatch && method === "POST") {
    assertSameOrigin(request);
    const body = await readJsonBody(request);
    const id = decodeURIComponent(archiveMatch[1]);
    const version = parseVersion(body.version);
    const session = parseSession(body);
    const task = archiveMatch[2] === "archive" ? db.archiveTask(id, version, session) : db.restoreTask(id, version, session);
    events.emit(archiveMatch[2] === "archive" ? "task.archived" : "task.restored", { task });
    sendJson(response, 200, { task });
    return;
  }

  // ---- tasks/:id/comments ----
  const commentsMatch = path.match(/^\/taskboard\/api\/tasks\/([^/]+)\/comments$/);
  if (commentsMatch) {
    const taskId = decodeURIComponent(commentsMatch[1]);
    if (method === "GET") {
      sendJson(response, 200, { comments: db.listComments(taskId) });
      return;
    }
    if (method === "POST") {
      assertSameOrigin(request);
      const body = await readJsonBody(request);
      const comment = db.createComment(taskId, {
        body: stringField(body.body, "body", { required: true, maxLength: 10000 }),
        session: parseSession(body),
        actor: actorFromRequest(request),
      });
      events.emit("comment.created", { comment });
      sendJson(response, 200, { comment });
      return;
    }
  }

  // ---- comments/:id ----
  const commentMatch = path.match(/^\/taskboard\/api\/comments\/([^/]+)$/);
  if (commentMatch) {
    const id = decodeURIComponent(commentMatch[1]);
    if (method === "PATCH") {
      assertSameOrigin(request);
      const body = await readJsonBody(request);
      const comment = db.updateComment(id, parseVersion(body.version), stringField(body.body, "body", { required: true, maxLength: 10000 }), parseSession(body));
      events.emit("comment.updated", { comment });
      sendJson(response, 200, { comment });
      return;
    }
    if (method === "DELETE") {
      assertSameOrigin(request);
      const body = await readJsonBody(request);
      const comment = db.deleteComment(id, parseVersion(body.version));
      events.emit("comment.deleted", { comment });
      response.writeHead(204).end();
      return;
    }
  }

  throw new ApiError(404, "NOT_FOUND", `No ${method} ${path}`);
}

function assertSameOrigin(request) {
  if (!sameOrigin(request)) {
    throw new ApiError(403, "CROSS_ORIGIN", "Cross-origin request rejected");
  }
}

function slugify(name) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return slug || "project";
}
