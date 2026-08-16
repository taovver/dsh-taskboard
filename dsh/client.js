window.__ModuleLoader__.load({ id: "dsh-taskboard", factory: (require) => {

		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// client/src/index.js
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);

// client/src/TaskBoardView.jsx
var import_jsx_runtime4 = require("react/jsx-runtime");
var import_react4 = require("react");
var import_dsh_client_ui_primitives4 = require("@deepseek-ai/dsh-client-ui-primitives");

// client/src/useBoard.js
var import_react = require("react");

// client/src/api.js
var BASE = "/taskboard/api";
async function request(method, path, body) {
  const options = { method, headers: {} };
  if (body !== void 0) {
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
function listProjects() {
  return request("GET", "/projects");
}
function listTasks(projectId, archived = "false") {
  return request("GET", `/tasks?project=${encodeURIComponent(projectId)}&archived=${archived}`);
}
function getTask(id) {
  return request("GET", `/tasks/${encodeURIComponent(id)}`);
}
function createTask(body) {
  return request("POST", "/tasks", body);
}
function updateTask(id, body) {
  return request("PATCH", `/tasks/${encodeURIComponent(id)}`, body);
}
function moveTask(id, body) {
  return request("POST", `/tasks/${encodeURIComponent(id)}/move`, body);
}
function archiveTask(id, version) {
  return request("POST", `/tasks/${encodeURIComponent(id)}/archive`, { version });
}
function restoreTask(id, version) {
  return request("POST", `/tasks/${encodeURIComponent(id)}/restore`, { version });
}
function listComments(taskId) {
  return request("GET", `/tasks/${encodeURIComponent(taskId)}/comments`);
}
function addComment(taskId, body) {
  return request("POST", `/tasks/${encodeURIComponent(taskId)}/comments`, body);
}
function sessionAttribution(sessionId, sessions) {
  if (!sessionId) return {};
  const title = sessions?.title?.(sessionId) ?? null;
  return { sessionId, sessionTitle: title ?? void 0 };
}

// client/src/useBoard.js
function useBoard() {
  const [projects, setProjects] = (0, import_react.useState)([]);
  const [tasks, setTasks] = (0, import_react.useState)([]);
  const [projectId, setProjectId] = (0, import_react.useState)("local");
  const [loading, setLoading] = (0, import_react.useState)(true);
  const [error, setError] = (0, import_react.useState)(null);
  const projectIdRef = (0, import_react.useRef)(projectId);
  projectIdRef.current = projectId;
  const reload = (0, import_react.useCallback)(async () => {
    try {
      const [p, t] = await Promise.all([
        listProjects(),
        listTasks(projectIdRef.current, "false")
      ]);
      setProjects(p.projects ?? []);
      setTasks(t.tasks ?? []);
      setProjectId((cur) => {
        const exists = (p.projects ?? []).some((x) => x.id === cur);
        return exists || !p.projects?.length ? cur : p.projects[0].id;
      });
      setError(null);
    } catch (e) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, []);
  (0, import_react.useEffect)(() => {
    reload();
  }, [reload, projectId]);
  (0, import_react.useEffect)(() => {
    let timer = null;
    const source = new EventSource("/taskboard/api/events");
    source.onmessage = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        reload();
      }, 300);
    };
    source.onerror = () => {
    };
    return () => {
      if (timer) clearTimeout(timer);
      source.close();
    };
  }, [reload]);
  return { projects, tasks, projectId, setProjectId, loading, error, reload };
}

// client/src/BoardColumn.jsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var import_react2 = require("react");
var import_dsh_client_ui_primitives2 = require("@deepseek-ai/dsh-client-ui-primitives");

// client/src/TaskCard.jsx
var import_jsx_runtime = require("react/jsx-runtime");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
var PRIORITY_CLASS = { urgent: "tb-pill-urgent", high: "tb-pill-high", medium: "tb-pill-medium", low: "tb-pill-low" };
function TaskCard({ task, t, onOpen, onOpenSession }) {
  const priorityLabel = t(task.priority) || task.priority;
  const labels = Array.isArray(task.labels) ? task.labels.slice(0, 3) : [];
  return (0, import_jsx_runtime.jsx)("div", {
    className: "tb-card",
    draggable: true,
    onDragStart: (e) => {
      e.dataTransfer.setData("text/plain", task.id);
      e.dataTransfer.effectAllowed = "move";
    },
    onClick: () => onOpen(task),
    children: (0, import_jsx_runtime.jsx)("div", {
      className: "tb-card-inner",
      children: [
        (0, import_jsx_runtime.jsx)("div", { className: "tb-card-id", children: task.identifier }),
        (0, import_jsx_runtime.jsx)("div", { className: "tb-card-title", children: task.title }),
        (0, import_jsx_runtime.jsx)("div", {
          className: "tb-card-meta",
          children: [
            task.priority !== "none" ? (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Pill, { className: `tb-pill ${PRIORITY_CLASS[task.priority] || ""}`, children: priorityLabel }) : null,
            ...labels.map((label) => (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Pill, { className: "tb-pill tb-label-chip", children: label }, label)),
            task.sessionTitle ? (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Pill, {
              className: "tb-pill tb-session-chip",
              title: task.sessionId,
              onClick: (e) => {
                e.stopPropagation();
                onOpenSession?.(task);
              },
              children: task.sessionTitle
            }) : null
          ]
        })
      ]
    })
  });
}

// client/src/BoardColumn.jsx
function BoardColumn({ status, label, tasks, t, onOpenCard, onDropTask, onQuickAdd, onOpenSession }) {
  const [dragover, setDragover] = (0, import_react2.useState)(false);
  const [adding, setAdding] = (0, import_react2.useState)(false);
  const [title, setTitle] = (0, import_react2.useState)("");
  function onDrop(e) {
    e.preventDefault();
    setDragover(false);
    const taskId = e.dataTransfer.getData("text/plain");
    if (taskId) onDropTask(taskId, status);
  }
  function submitQuickAdd() {
    const value = title.trim();
    setTitle("");
    setAdding(false);
    if (value) onQuickAdd(status, value);
  }
  return (0, import_jsx_runtime2.jsx)("div", {
    className: `tb-column${dragover ? " tb-column-dragover" : ""}`,
    onDragOver: (e) => {
      e.preventDefault();
      setDragover(true);
    },
    onDragLeave: () => setDragover(false),
    onDrop,
    children: [
      (0, import_jsx_runtime2.jsx)("div", {
        className: "tb-column-head",
        children: [
          (0, import_jsx_runtime2.jsx)("span", { children: label }),
          (0, import_jsx_runtime2.jsx)("span", { className: "tb-column-count", children: String(tasks.length) })
        ]
      }),
      (0, import_jsx_runtime2.jsx)("div", {
        className: "tb-column-list",
        children: tasks.length ? tasks.map(
          (task) => (0, import_jsx_runtime2.jsx)(TaskCard, { task, t, onOpen: onOpenCard, onOpenSession }, task.id)
        ) : (0, import_jsx_runtime2.jsx)("div", { className: "tb-empty", children: t.noTasks })
      }),
      adding ? (0, import_jsx_runtime2.jsx)("div", {
        className: "tb-quickadd",
        children: (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Input, {
          autoFocus: true,
          value: title,
          placeholder: t.quickAdd,
          onChange: (e) => setTitle(e.target.value),
          onKeyDown: (e) => {
            if (e.key === "Enter") submitQuickAdd();
            if (e.key === "Escape") {
              setAdding(false);
              setTitle("");
            }
          },
          onBlur: submitQuickAdd
        })
      }) : (0, import_jsx_runtime2.jsx)("button", {
        className: "tb-quickadd-btn",
        onClick: () => setAdding(true),
        children: "+",
        style: {
          background: "none",
          border: "none",
          color: "var(--dsw-alias-fg-muted, #8b93a3)",
          cursor: "pointer",
          fontSize: 14,
          padding: "2px 6px",
          textAlign: "left"
        }
      })
    ]
  });
}

// client/src/TaskDetailModal.jsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var import_react3 = require("react");
var import_dsh_client_ui_primitives3 = require("@deepseek-ai/dsh-client-ui-primitives");

// client/src/locales.js
var NS = "dsh-taskboard";
var zh = {
  tab: "\u4EFB\u52A1\u770B\u677F",
  newTask: "\u65B0\u5EFA\u4EFB\u52A1",
  quickAdd: "\u5FEB\u901F\u6DFB\u52A0\u2026",
  noTasks: "\u7A7A",
  edit: "\u7F16\u8F91",
  save: "\u4FDD\u5B58",
  cancel: "\u53D6\u6D88",
  archive: "\u5F52\u6863",
  restore: "\u6062\u590D",
  openInSession: "\u5728\u5BF9\u8BDD\u4E2D\u6253\u5F00",
  comments: "\u8BC4\u8BBA",
  addComment: "\u5199\u8BC4\u8BBA\u2026",
  send: "\u53D1\u9001",
  priority: "\u4F18\u5148\u7EA7",
  labels: "\u6807\u7B7E",
  status: "\u72B6\u6001",
  description: "\u63CF\u8FF0",
  version: "\u7248\u672C",
  session: "\u4F1A\u8BDD",
  loading: "\u52A0\u8F7D\u4E2D\u2026",
  conflict: "\u4EFB\u52A1\u5DF2\u88AB\u4FEE\u6539\uFF0C\u5DF2\u5237\u65B0",
  backlog: "\u79EF\u538B",
  todo: "\u5F85\u529E",
  in_progress: "\u6267\u884C\u4E2D",
  in_review: "\u5F85\u786E\u8BA4",
  blocked: "\u53D7\u963B",
  done: "\u5DF2\u5B8C\u6210",
  canceled: "\u5DF2\u53D6\u6D88"
};
var en = {
  tab: "Taskboard",
  newTask: "New task",
  quickAdd: "Quick add\u2026",
  noTasks: "Empty",
  edit: "Edit",
  save: "Save",
  cancel: "Cancel",
  archive: "Archive",
  restore: "Restore",
  openInSession: "Open in conversation",
  comments: "Comments",
  addComment: "Write a comment\u2026",
  send: "Send",
  priority: "Priority",
  labels: "Labels",
  status: "Status",
  description: "Description",
  version: "Version",
  session: "Session",
  loading: "Loading\u2026",
  conflict: "Task changed; refreshed",
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In progress",
  in_review: "In review",
  blocked: "Blocked",
  done: "Done",
  canceled: "Canceled"
};
var COLUMN_ORDER = ["backlog", "todo", "in_progress", "in_review", "blocked", "done"];

// client/src/TaskDetailModal.jsx
var STATUSES = ["backlog", "todo", "in_progress", "in_review", "blocked", "done", "canceled"];
var PRIORITIES = ["none", "urgent", "high", "medium", "low"];
function TaskDetailModal({ task, project, sessionId, sessions, t, onClose, onChanged, openSession }) {
  const [current, setCurrent] = (0, import_react3.useState)(task);
  const [comments, setComments] = (0, import_react3.useState)([]);
  const [title, setTitle] = (0, import_react3.useState)(task.title);
  const [description, setDescription] = (0, import_react3.useState)(task.description || "");
  const [status, setStatus] = (0, import_react3.useState)(task.status);
  const [priority, setPriority] = (0, import_react3.useState)(task.priority);
  const [labelsText, setLabelsText] = (0, import_react3.useState)((task.labels || []).join(", "));
  const [commentText, setCommentText] = (0, import_react3.useState)("");
  const [busy, setBusy] = (0, import_react3.useState)(false);
  (0, import_react3.useEffect)(() => {
    listComments(task.id).then((d) => setComments(d.comments ?? [])).catch(() => {
    });
  }, [task.id]);
  function attr() {
    return sessionAttribution(sessionId, sessions);
  }
  async function save() {
    setBusy(true);
    try {
      const labels = labelsText.split(",").map((s) => s.trim()).filter(Boolean);
      const changes = { title, description, priority };
      if (status !== current.status) changes.status = status;
      const updated = await updateTask(current.id, { version: current.version, changes, ...attr() });
      setCurrent(updated.task);
      onChanged(updated.task);
    } catch (e) {
      alert(e?.message ?? String(e));
      onChanged(await getTask(current.id).then((d) => d.task));
    } finally {
      setBusy(false);
    }
  }
  async function changeStatus(next) {
    if (next === current.status) return;
    setBusy(true);
    try {
      const updated = await moveTask(current.id, { version: current.version, status: next, ...attr() });
      setCurrent(updated.task);
      onChanged(updated.task);
    } catch (e) {
      alert(e?.message ?? String(e));
      onChanged(await getTask(current.id).then((d) => d.task));
    } finally {
      setBusy(false);
    }
  }
  async function toggleArchive() {
    setBusy(true);
    try {
      const fn = current.archivedAt ? restoreTask : archiveTask;
      const updated = await fn(current.id, current.version);
      setCurrent(updated.task);
      onChanged(updated.task);
    } catch (e) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }
  async function submitComment() {
    const body = commentText.trim();
    if (!body) return;
    setCommentText("");
    try {
      const d = await addComment(current.id, { body, ...attr() });
      setComments((c) => [...c, d.comment]);
    } catch (e) {
      alert(e?.message ?? String(e));
    }
  }
  return (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.Modal, {
    open: true,
    onClose,
    title: `${current.identifier} \xB7 ${current.title}`,
    description: current.sessionTitle ? `\u4F1A\u8BDD\uFF1A${current.sessionTitle}` : void 0,
    children: (0, import_jsx_runtime3.jsx)("div", {
      className: "tb-modal-body",
      children: [
        (0, import_jsx_runtime3.jsx)("div", {
          className: "tb-field",
          children: [(0, import_jsx_runtime3.jsx)("label", { children: t.edit }), (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.Input, { value: title, onChange: (e) => setTitle(e.target.value) })]
        }),
        (0, import_jsx_runtime3.jsx)("div", {
          className: "tb-field",
          children: [(0, import_jsx_runtime3.jsx)("label", { children: t.description }), (0, import_jsx_runtime3.jsx)("textarea", {
            value: description,
            rows: 4,
            onChange: (e) => setDescription(e.target.value),
            style: {
              background: "var(--dsw-alias-bg, #1b1f27)",
              border: "1px solid var(--dsw-alias-border, #2a2f3a)",
              borderRadius: 6,
              color: "inherit",
              padding: 6,
              font: "inherit",
              fontSize: 13,
              resize: "vertical"
            }
          })]
        }),
        (0, import_jsx_runtime3.jsx)("div", {
          className: "tb-field",
          children: [
            (0, import_jsx_runtime3.jsx)("label", { children: `${t.priority} / ${t.labels}` }),
            (0, import_jsx_runtime3.jsx)("div", {
              style: { display: "flex", gap: 8, flexWrap: "wrap" },
              children: [
                (0, import_jsx_runtime3.jsx)("select", {
                  value: priority,
                  onChange: (e) => setPriority(e.target.value),
                  style: { background: "var(--dsw-alias-bg, #1b1f27)", color: "inherit", border: "1px solid var(--dsw-alias-border, #2a2f3a)", borderRadius: 6, padding: "4px 8px" },
                  children: PRIORITIES.map((p) => (0, import_jsx_runtime3.jsx)("option", { value: p, children: t(p) || p }, p))
                }),
                (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.Input, { value: labelsText, placeholder: "a, b, c", onChange: (e) => setLabelsText(e.target.value), style: { flex: 1 } })
              ]
            })
          ]
        }),
        (0, import_jsx_runtime3.jsx)("div", {
          className: "tb-field",
          children: [
            (0, import_jsx_runtime3.jsx)("label", { children: t.status }),
            (0, import_jsx_runtime3.jsx)("div", {
              style: { display: "flex", gap: 6, flexWrap: "wrap" },
              children: STATUSES.filter((s) => s !== "canceled").map(
                (s) => (0, import_jsx_runtime3.jsx)("button", {
                  key: s,
                  disabled: busy,
                  onClick: () => changeStatus(s),
                  style: {
                    border: `1px solid ${s === current.status ? "var(--dsw-alias-accent, #5b8cff)" : "var(--dsw-alias-border, #2a2f3a)"}`,
                    borderRadius: 999,
                    background: s === current.status ? "var(--dsw-alias-accent, #5b8cff)22" : "transparent",
                    color: "inherit",
                    padding: "2px 10px",
                    fontSize: 12,
                    cursor: "pointer"
                  },
                  children: t(s) || s
                })
              )
            })
          ]
        }),
        (0, import_jsx_runtime3.jsx)("div", {
          className: "tb-field",
          children: [
            (0, import_jsx_runtime3.jsx)("label", { children: t.comments }),
            (0, import_jsx_runtime3.jsx)("div", {
              children: comments.length ? comments.map(
                (c) => (0, import_jsx_runtime3.jsx)("div", {
                  className: "tb-comment",
                  children: [
                    (0, import_jsx_runtime3.jsx)("span", { className: "tb-comment-author", children: c.authorName }),
                    c.sessionTitle ? (0, import_jsx_runtime3.jsx)("span", { style: { color: "var(--dsw-alias-fg-muted, #8b93a3)", marginRight: 6 }, children: `[${c.sessionTitle}]` }) : null,
                    (0, import_jsx_runtime3.jsx)("span", { children: c.body })
                  ]
                }, c.id)
              ) : (0, import_jsx_runtime3.jsx)("div", { className: "tb-empty", children: t.noTasks })
            })
          ]
        }),
        (0, import_jsx_runtime3.jsx)("div", {
          style: { display: "flex", gap: 6 },
          children: [
            (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.Input, {
              value: commentText,
              placeholder: t.addComment,
              onChange: (e) => setCommentText(e.target.value),
              onKeyDown: (e) => e.key === "Enter" && submitComment(),
              style: { flex: 1 }
            }),
            (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.Button, { size: "sm", onClick: submitComment, children: t.send })
          ]
        }),
        (0, import_jsx_runtime3.jsx)("div", {
          className: "tb-actions",
          children: [
            (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.Button, { variant: "ghost", size: "sm", onClick: toggleArchive, disabled: busy, children: current.archivedAt ? t.restore : t.archive }),
            openSession ? (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.Button, { variant: "outline", size: "sm", onClick: () => openSession(current, project), children: t.openInSession }) : null,
            (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.Button, { variant: "primary", size: "sm", onClick: save, disabled: busy, children: t.save })
          ]
        })
      ]
    })
  });
}

// client/src/TaskBoardView.jsx
function TaskBoardView({ sessionId, useSessions, t, openSession }) {
  const { projects, tasks, projectId, setProjectId, loading, error, reload } = useBoard();
  const [detail, setDetail] = (0, import_react4.useState)(null);
  const [creating, setCreating] = (0, import_react4.useState)(false);
  const [newTitle, setNewTitle] = (0, import_react4.useState)("");
  const [newPriority, setNewPriority] = (0, import_react4.useState)("medium");
  const currentSessionTitle = useSessions?.((s) => s?.sessionById?.[sessionId]?.title ?? s?.sessionsById?.[sessionId]?.title ?? null) ?? null;
  function attr() {
    return sessionAttribution(sessionId, { title: () => currentSessionTitle });
  }
  async function handleDrop(taskId, status) {
    const task = tasks.find((x) => x.id === taskId || x.identifier === taskId);
    if (!task || task.status === status) return;
    try {
      await moveTask(task.id, { version: task.version, status, ...attr() });
    } catch (e) {
      alert(e?.message ?? String(e));
    }
    reload();
  }
  async function handleQuickAdd(status, title) {
    try {
      await createTask({ projectId, title, status, ...attr() });
    } catch (e) {
      alert(e?.message ?? String(e));
    }
    reload();
  }
  async function handleCreate() {
    const title = newTitle.trim();
    if (!title) return;
    setCreating(false);
    try {
      await createTask({ projectId, title, priority: newPriority, status: "backlog", ...attr() });
      setNewTitle("");
    } catch (e) {
      alert(e?.message ?? String(e));
    }
    reload();
  }
  const byStatus = (status) => tasks.filter((x) => x.status === status && !x.archivedAt);
  return (0, import_jsx_runtime4.jsx)("div", {
    className: "tb-board",
    children: [
      (0, import_jsx_runtime4.jsx)("div", {
        className: "tb-toolbar",
        children: [
          (0, import_jsx_runtime4.jsx)("span", { className: "tb-title", children: t.tab }),
          (0, import_jsx_runtime4.jsx)("div", {
            style: { display: "flex", gap: 6, flexWrap: "wrap" },
            children: projects.map(
              (p) => (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives4.Pill, {
                key: p.id,
                active: p.id === projectId,
                onClick: () => setProjectId(p.id),
                children: `${p.name}`
              })
            )
          }),
          (0, import_jsx_runtime4.jsx)("span", { style: { flex: 1 } }),
          (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives4.Button, { size: "sm", onClick: () => setCreating(true), children: t.newTask })
        ]
      }),
      loading ? (0, import_jsx_runtime4.jsx)("div", { className: "tb-empty", children: t.loading }) : error ? (0, import_jsx_runtime4.jsx)("div", { className: "tb-empty", children: error }) : (0, import_jsx_runtime4.jsx)("div", {
        className: "tb-columns",
        children: COLUMN_ORDER.map(
          (status) => (0, import_jsx_runtime4.jsx)(BoardColumn, {
            key: status,
            status,
            label: t(status) || status,
            tasks: byStatus(status),
            t,
            onOpenCard: (task) => setDetail(task),
            onDropTask: handleDrop,
            onQuickAdd: handleQuickAdd,
            onOpenSession: openSession
          })
        )
      }),
      detail ? (0, import_jsx_runtime4.jsx)(TaskDetailModal, {
        task: detail,
        project: projects.find((p) => p.id === detail.projectId),
        sessionId,
        sessions: { title: () => currentSessionTitle },
        t,
        onClose: () => setDetail(null),
        onChanged: (updated) => {
          setDetail(updated);
          reload();
        },
        openSession
      }) : null,
      creating ? (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives4.Modal, {
        open: true,
        onClose: () => setCreating(false),
        title: t.newTask,
        children: (0, import_jsx_runtime4.jsx)("div", {
          className: "tb-modal-body",
          children: [
            (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives4.Input, {
              autoFocus: true,
              value: newTitle,
              placeholder: t.newTask,
              onChange: (e) => setNewTitle(e.target.value),
              onKeyDown: (e) => e.key === "Enter" && handleCreate()
            }),
            (0, import_jsx_runtime4.jsx)("div", {
              className: "tb-actions",
              children: [
                (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives4.Button, { variant: "ghost", size: "sm", onClick: () => setCreating(false), children: t.cancel }),
                (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives4.Button, { variant: "primary", size: "sm", onClick: handleCreate, children: t.newTask })
              ]
            })
          ]
        })
      }) : null
    ]
  });
}

// client/src/styles.js
var CSS = `
[data-plugin="task-board-css"] {
  /* \u5BB9\u5668\u5360\u6EE1\u4F1A\u8BDD\u4E3B\u533A */
}
.tb-board { display: flex; flex-direction: column; gap: 12px; height: 100%; padding: 12px; box-sizing: border-box; }
.tb-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.tb-toolbar .tb-title { font-weight: 600; font-size: 15px; }
.tb-columns { display: flex; gap: 10px; flex: 1; overflow-x: auto; align-items: flex-start; }
.tb-column {
  flex: 1 1 0; min-width: 210px; max-width: 280px;
  background: color-mix(in srgb, var(--dsw-alias-bg, #1b1f27) 60%, transparent);
  border: 1px solid var(--dsw-alias-border, #2a2f3a);
  border-radius: 10px; padding: 8px; display: flex; flex-direction: column; gap: 6px;
}
.tb-column-head { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; padding: 2px 4px; }
.tb-column-count {
  font-size: 11px; color: var(--dsw-alias-fg-muted, #8b93a3);
  background: var(--dsw-alias-border, #2a2f3a); border-radius: 999px; padding: 0 8px;
}
.tb-column-list { display: flex; flex-direction: column; gap: 6px; min-height: 40px; }
.tb-card {
  background: var(--dsw-alias-bg-elevated, #22262f);
  border: 1px solid var(--dsw-alias-border, #2a2f3a);
  border-radius: 8px; padding: 8px 10px; cursor: grab; display: flex; flex-direction: column; gap: 4px;
}
.tb-card:hover { border-color: var(--dsw-alias-accent, #5b8cff); }
.tb-card.dragging { opacity: 0.4; }
.tb-card-id { font-size: 10px; color: var(--dsw-alias-fg-muted, #8b93a3); font-family: var(--dsw-font-mono, monospace); }
.tb-card-title { font-size: 13px; line-height: 1.35; word-break: break-word; }
.tb-card-meta { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; }
.tb-pill { font-size: 10px; padding: 0 6px; border-radius: 999px; line-height: 16px; }
.tb-pill-urgent { background: #e5484d33; color: #ff6369; }
.tb-pill-high   { background: #f76b1533; color: #ff9e5e; }
.tb-pill-medium { background: #ffb22433; color: #ffc94d; }
.tb-pill-low    { background: #30a46c33; color: #6bd9a3; }
.tb-label-chip { background: var(--dsw-alias-border, #2a2f3a); color: var(--dsw-alias-fg-muted, #8b93a3); }
.tb-session-chip {
  background: #5b8cff22; color: var(--dsw-alias-accent, #5b8cff);
  cursor: pointer; text-decoration: underline dotted;
}
.tb-column-dragover { outline: 2px dashed var(--dsw-alias-accent, #5b8cff); }
.tb-quickadd input { background: transparent; border: 1px solid transparent; border-radius: 6px; padding: 4px 8px; font-size: 12px; width: 100%; }
.tb-quickadd input:focus { border-color: var(--dsw-alias-accent, #5b8cff); outline: none; }
.tb-new-btn { font-size: 13px; }
.tb-modal-body { display: flex; flex-direction: column; gap: 10px; min-width: 380px; max-width: 560px; }
.tb-field { display: flex; flex-direction: column; gap: 4px; }
.tb-field label { font-size: 11px; color: var(--dsw-alias-fg-muted, #8b93a3); }
.tb-comment { font-size: 12px; border-top: 1px solid var(--dsw-alias-border, #2a2f3a); padding: 6px 0; }
.tb-comment .tb-comment-author { font-weight: 600; margin-right: 6px; }
.tb-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; }
.tb-empty { font-size: 12px; color: var(--dsw-alias-fg-muted, #8b93a3); text-align: center; padding: 16px 0; }
`;

// client/src/index.js
var name = "dsh-taskboard";
var inject = ["slots", "locale", "connection"];
function unwrap(res) {
  return res?.result?.value ?? res?.value ?? res?.result ?? res;
}
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-taskboard: dictionaries");
  ctx.effect(() => {
    const style = document.createElement("style");
    style.setAttribute("data-plugin", "dsh-taskboard");
    style.textContent = CSS;
    document.head.appendChild(style);
    return () => style.remove();
  }, "dsh-taskboard: styles");
  async function openSession(task, project) {
    const conn = ctx.connection;
    if (!conn?.api?.sessions?.create) {
      console.warn("[taskboard] connection.api.sessions unavailable; openSession skipped");
      return;
    }
    try {
      const created = unwrap(await conn.api.sessions.create(project?.workspacePath ? { cwd: project.workspacePath } : {}));
      const sid = created?.sessionId ?? created?.id;
      if (!sid) {
        console.warn("[taskboard] session.create returned no id", created);
        return;
      }
      const intro = `\u7EE7\u7EED\u5904\u7406\u770B\u677F\u4EFB\u52A1 ${task.identifier}\uFF1A${task.title}

${task.description ?? ""}
\uFF08\u4EFB\u52A1\u5F53\u524D\u72B6\u6001\uFF1A${task.status}\uFF0C\u4F18\u5148\u7EA7\uFF1A${task.priority}\uFF0C\u9879\u76EE\uFF1A${task.projectId}\uFF09
\u8BF7\u7528 taskboard \u5DE5\u5177\u63A8\u8FDB\u8FD9\u4E2A\u4EFB\u52A1\uFF1A\u5148 taskboard_query \u67E5\u770B\uFF0C\u5904\u7406\u540E move_task \u6D41\u8F6C\u72B6\u6001\uFF0C\u5B8C\u6210\u540E\u79FB\u5165 in_review \u7B49\u7528\u6237\u786E\u8BA4\u3002`;
      await conn.api.sessions.prompt({ sessionId: sid, mode: "queue", content: [{ type: "text", text: intro }] });
      console.log(`[taskboard] opened session ${sid} for ${task.identifier}`);
    } catch (e) {
      console.error("[taskboard] openSession failed", e);
    }
  }
  const tabLabel = () => {
    try {
      return ctx.locale?.bind?.(NS)?.("tab") ?? "\u4EFB\u52A1\u770B\u677F";
    } catch {
      return "\u4EFB\u52A1\u770B\u677F";
    }
  };
  ctx.slots.inject(
    "conversation.view",
    () => ctx.slots.register(
      {
        name: "conversation.view",
        id: "task-board",
        order: 30,
        label: tabLabel,
        locale: NS,
        inject: () => ({ openSession })
      },
      TaskBoardView
    )
  );
}

		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
