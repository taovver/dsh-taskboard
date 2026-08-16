// 任务详情弹窗：编辑字段、评论线程、状态/优先级/标签、归档、在对话中打开。
import { jsx } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Modal, Button, Input } from "@deepseek-ai/dsh-client-ui-primitives";
import { getTask, updateTask, archiveTask, restoreTask, listComments, addComment, moveTask, sessionAttribution } from "./api.js";
import { COLUMN_ORDER } from "./locales.js";

const STATUSES = ["backlog", "todo", "in_progress", "in_review", "blocked", "done", "canceled"];
const PRIORITIES = ["none", "urgent", "high", "medium", "low"];

export function TaskDetailModal({ task, project, sessionId, sessions, t, onClose, onChanged, openSession }) {
  const [current, setCurrent] = useState(task);
  const [comments, setComments] = useState([]);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [status, setStatus] = useState(task.status);
  const [priority, setPriority] = useState(task.priority);
  const [labelsText, setLabelsText] = useState((task.labels || []).join(", "));
  const [commentText, setCommentText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listComments(task.id).then((d) => setComments(d.comments ?? [])).catch(() => {});
  }, [task.id]);

  function attr() {
    return sessionAttribution(sessionId, sessions);
  }

  async function save() {
    setBusy(true);
    try {
      const labels = labelsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
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

  return jsx(Modal, {
    open: true,
    onClose,
    title: `${current.identifier} · ${current.title}`,
    description: current.sessionTitle ? `会话：${current.sessionTitle}` : undefined,
    children: jsx("div", {
      className: "tb-modal-body",
      children: [
        jsx("div", {
          className: "tb-field",
          children: [jsx("label", { children: t.edit }), jsx(Input, { value: title, onChange: (e) => setTitle(e.target.value) })],
        }),
        jsx("div", {
          className: "tb-field",
          children: [jsx("label", { children: t.description }), jsx("textarea", {
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
              resize: "vertical",
            },
          })],
        }),
        jsx("div", {
          className: "tb-field",
          children: [
            jsx("label", { children: `${t.priority} / ${t.labels}` }),
            jsx("div", {
              style: { display: "flex", gap: 8, flexWrap: "wrap" },
              children: [
                jsx("select", {
                  value: priority,
                  onChange: (e) => setPriority(e.target.value),
                  style: { background: "var(--dsw-alias-bg, #1b1f27)", color: "inherit", border: "1px solid var(--dsw-alias-border, #2a2f3a)", borderRadius: 6, padding: "4px 8px" },
                  children: PRIORITIES.map((p) => jsx("option", { value: p, children: t(p) || p }, p)),
                }),
                jsx(Input, { value: labelsText, placeholder: "a, b, c", onChange: (e) => setLabelsText(e.target.value), style: { flex: 1 } }),
              ],
            }),
          ],
        }),
        jsx("div", {
          className: "tb-field",
          children: [
            jsx("label", { children: t.status }),
            jsx("div", {
              style: { display: "flex", gap: 6, flexWrap: "wrap" },
              children: STATUSES.filter((s) => s !== "canceled").map((s) =>
                jsx("button", {
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
                    cursor: "pointer",
                  },
                  children: t(s) || s,
                }),
              ),
            }),
          ],
        }),
        jsx("div", {
          className: "tb-field",
          children: [
            jsx("label", { children: t.comments }),
            jsx("div", {
              children: comments.length
                ? comments.map((c) =>
                    jsx("div", {
                      className: "tb-comment",
                      children: [
                        jsx("span", { className: "tb-comment-author", children: c.authorName }),
                        c.sessionTitle ? jsx("span", { style: { color: "var(--dsw-alias-fg-muted, #8b93a3)", marginRight: 6 }, children: `[${c.sessionTitle}]` }) : null,
                        jsx("span", { children: c.body }),
                      ],
                    }, c.id),
                  )
                : jsx("div", { className: "tb-empty", children: t.noTasks }),
            }),
          ],
        }),
        jsx("div", {
          style: { display: "flex", gap: 6 },
          children: [
            jsx(Input, {
              value: commentText,
              placeholder: t.addComment,
              onChange: (e) => setCommentText(e.target.value),
              onKeyDown: (e) => e.key === "Enter" && submitComment(),
              style: { flex: 1 },
            }),
            jsx(Button, { size: "sm", onClick: submitComment, children: t.send }),
          ],
        }),
        jsx("div", {
          className: "tb-actions",
          children: [
            jsx(Button, { variant: "ghost", size: "sm", onClick: toggleArchive, disabled: busy, children: current.archivedAt ? t.restore : t.archive }),
            openSession
              ? jsx(Button, { variant: "outline", size: "sm", onClick: () => openSession(current, project), children: t.openInSession })
              : null,
            jsx(Button, { variant: "primary", size: "sm", onClick: save, disabled: busy, children: t.save }),
          ],
        }),
      ],
    }),
  });
}
