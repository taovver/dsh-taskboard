// 模型工具：taskboard_query（只读）+ taskboard_mutate（写）。
// 会话归属：execute 的 exec.agent.id 即 dsh 会话 id，写库时记录 session_id + session_title。
import { ApiError } from "./db.js";
import { TASKBOARD_PROTOCOL, renderTask, renderConflict } from "./prompt.js";
import { isTaskStatus, isTaskPriority } from "./domain.js";

function present(args, kind) {
  return { card: "generic", title: `taskboard_${args.action}`, kind, rawInput: args };
}

function sessionOf(exec, sessions) {
  const id = exec?.agent?.id ?? exec?.sessionId ?? null;
  if (!id) return null;
  return { id, title: sessions.title(id) ?? null };
}

function actorOf(exec, sessions) {
  const session = sessionOf(exec, sessions);
  return session
    ? { type: "agent", id: session.id, name: session.title || "Agent", avatarUrl: null }
    : { type: "user", id: "local-user", name: "本地用户", avatarUrl: null };
}

function renderTasks(tasks) {
  if (!tasks.length) return "（看板为空）";
  return tasks.map(renderTask).join("\n");
}

function renderComments(comments) {
  if (!comments.length) return "（暂无评论）";
  return comments
    .map((c) => `- ${c.authorName}${c.sessionTitle ? ` [${c.sessionTitle}]` : ""} · ${c.body}`)
    .join("\n");
}

// 统一把 ApiError 转成带 guidance 的可读错误，模型能直接理解下一步动作。
function asError(error) {
  if (error instanceof ApiError && error.code === "VERSION_CONFLICT") {
    return new Error(renderConflict(error));
  }
  return error;
}

const TEXT_OUTPUT = {
  type: "object",
  properties: { text: { type: "string" } },
  required: ["text"],
};

const STATUS_ENUM = ["backlog", "todo", "in_progress", "in_review", "blocked", "done", "canceled"];
const PRIORITY_ENUM = ["none", "urgent", "high", "medium", "low"];

function queryTool(db) {
  const parameters = {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["list_projects", "list_tasks", "get_task", "list_comments"],
        description: "要执行的只读操作",
      },
      projectId: { type: "string", description: "项目 id（list_tasks 过滤用，默认 local）" },
      status: { type: "string", enum: STATUS_ENUM, description: "按状态过滤任务" },
      archived: { type: "string", enum: ["false", "true", "all"], description: "是否含已归档任务" },
      id: { type: "string", description: "任务 id 或 identifier（get_task）" },
      taskId: { type: "string", description: "任务 id（list_comments）" },
    },
    required: ["action"],
  };
  return {
    name: "taskboard_query",
    description:
      "查询任务看板（只读，不修改数据）：列出项目/任务、按状态或项目过滤、读取单个任务详情或评论。看板是跨对话共享的，任何会话都能看到全部项目任务。用前先 list_projects 确认 projectId，处理任务前先 get_task 拿最新 version。",
    parameters,
    output: {
      schema: TEXT_OUTPUT,
      render: (_args, value) => [{ type: "text", text: value.text }],
    },
    isConcurrencySafe: () => true,
    presentCall: (args) => present(args, "read"),
    async execute(args, exec) {
      try {
        const action = args?.action;
        switch (action) {
          case "list_projects": {
            const projects = db.listProjects();
            return { text: projects.length ? projects.map((p) => `${p.id} (${p.name}) · ${p.issueCount} 个任务`).join("\n") : "（无项目）" };
          }
          case "list_tasks": {
            const tasks = db.listTasks({
              projectId: args.projectId ?? "local",
              status: isTaskStatus(args.status) ? args.status : undefined,
              archived: args.archived ?? "false",
            });
            return { text: renderTasks(tasks) };
          }
          case "get_task": {
            const task = db.getTask(args.id);
            if (!task) throw new Error(`任务 ${args.id} 不存在`);
            return { text: renderTask(task) + `\nversion=${task.version}` };
          }
          case "list_comments": {
            return { text: renderComments(db.listComments(args.taskId)) };
          }
          default:
            throw new Error(`未知 action: ${action}`);
        }
      } catch (error) {
        throw asError(error);
      }
    },
  };
}

function mutateTool(db, sessions) {
  const parameters = {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: [
          "create_project", "create_task", "update_task", "move_task",
          "archive_task", "restore_task", "add_comment", "update_comment", "delete_comment",
        ],
        description: "要执行的写操作",
      },
      name: { type: "string", description: "项目名（create_project）" },
      id: { type: "string", description: "项目 id（create_project 可选，默认由 name 生成）或任务/评论 id" },
      workspacePath: { type: "string", description: "项目工作区路径（create_project 可选）" },
      projectId: { type: "string", description: "项目 id（create_task 默认 local）" },
      title: { type: "string", description: "任务标题（create_task）" },
      description: { type: "string", description: "任务描述" },
      status: { type: "string", enum: STATUS_ENUM, description: "目标状态（move_task）；done 必须带 userConfirm" },
      priority: { type: "string", enum: PRIORITY_ENUM, description: "优先级" },
      labels: { type: "array", items: { type: "string" }, description: "标签数组" },
      changes: { type: "object", description: "update_task 的字段变更：{title?, description?, priority?, labels?}" },
      expectedVersion: { type: "integer", description: "期望版本号，必须是最近一次读取返回的 version；冲突会报 VERSION_CONFLICT" },
      userConfirm: { type: "string", description: "move_task 到 done 时必须引用用户明确确认接受的原话" },
      body: { type: "string", description: "评论内容（add_comment/update_comment）" },
      taskId: { type: "string", description: "评论所属任务 id（add_comment）" },
    },
    required: ["action"],
  };
  return {
    name: "taskboard_mutate",
    description:
      "修改任务看板（创建项目/任务、更新、移动状态、归档、评论）。" +
      TASKBOARD_PROTOCOL,
    parameters,
    output: {
      schema: TEXT_OUTPUT,
      render: (_args, value) => [{ type: "text", text: value.text }],
    },
    presentCall: (args) => present(args, args.action === "move_task" && args.status === "done" ? "write" : "write"),
    async execute(args, exec) {
      const action = args?.action;
      if (!action) throw new Error("缺少 action");
      const session = sessionOf(exec, sessions);
      const actor = actorOf(exec, sessions);
      try {
        switch (action) {
          case "create_project": {
            const project = db.createProject({
              id: args.id || slugify(args.name),
              name: args.name,
              workspacePath: args.workspacePath,
            });
            return { text: `项目已创建：${project.id} (${project.name})` };
          }
          case "create_task": {
            const task = db.createTask({
              projectId: args.projectId || "local",
              title: args.title,
              description: args.description ?? "",
              status: isTaskStatus(args.status) ? args.status : "backlog",
              priority: isTaskPriority(args.priority) ? args.priority : "none",
              labels: Array.isArray(args.labels) ? args.labels : [],
              session,
              actor,
            });
            return { text: `任务已创建：\n${renderTask(task)}\nversion=${task.version}` };
          }
          case "update_task": {
            const changes = {};
            if (typeof args.changes === "object" && args.changes) {
              for (const key of ["title", "description", "priority", "labels"]) {
                if (Object.hasOwn(args.changes, key)) changes[key] = args.changes[key];
              }
              if (Object.hasOwn(args.changes, "status") && isTaskStatus(args.changes.status)) changes.status = args.changes.status;
            }
            const task = db.updateTask(args.id, args.expectedVersion, changes, session);
            return { text: `任务已更新：\n${renderTask(task)}\nversion=${task.version}` };
          }
          case "move_task": {
            if (!isTaskStatus(args.status)) throw new Error(`无效状态: ${args.status}`);
            if (args.status === "done" && !(typeof args.userConfirm === "string" && args.userConfirm.trim())) {
              throw new Error('move_task 到 done 必须提供 userConfirm 并引用用户明确确认接受的原话；用户确认前任务应停留在 in_review');
            }
            const task = db.moveTask(args.id, args.expectedVersion, args.status, undefined, session);
            return { text: `任务已移动到 ${task.status}：\n${renderTask(task)}\nversion=${task.version}` };
          }
          case "archive_task": {
            const task = db.archiveTask(args.id, args.expectedVersion, session);
            return { text: `任务已归档：${task.identifier}` };
          }
          case "restore_task": {
            const task = db.restoreTask(args.id, args.expectedVersion, session);
            return { text: `任务已恢复：${task.identifier}` };
          }
          case "add_comment": {
            const comment = db.createComment(args.taskId, { body: args.body, session, actor });
            return { text: `评论已添加：${comment.body}` };
          }
          case "update_comment": {
            const comment = db.updateComment(args.id, args.expectedVersion, args.body, session);
            return { text: `评论已更新：${comment.body}` };
          }
          case "delete_comment": {
            db.deleteComment(args.id, args.expectedVersion);
            return { text: "评论已删除" };
          }
          default:
            throw new Error(`未知 action: ${action}`);
        }
      } catch (error) {
        throw asError(error);
      }
    },
  };
}

function slugify(name) {
  const slug = String(name ?? "project")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return slug || "project";
}

export function registerTaskboardTools(ctx, db, sessions) {
  const tools = [queryTool(db), mutateTool(db, sessions)];
  for (const tool of tools) {
    try {
      ctx.tools.register(tool);
    } catch (error) {
      console.error(`[taskboard] tool "${tool.name}" registration failed:`, error);
    }
  }
}
