// 看板主视图：注入 conversation.view 槽位，整页渲染。
import { jsx } from "react/jsx-runtime";
import { useState } from "react";
import { Button, Modal, Input, Pill } from "@deepseek-ai/dsh-client-ui-primitives";
import { useBoard } from "./useBoard.js";
import { BoardColumn } from "./BoardColumn.jsx";
import { TaskDetailModal } from "./TaskDetailModal.jsx";
import { createTask, moveTask, sessionAttribution } from "./api.js";
import { COLUMN_ORDER } from "./locales.js";

export function TaskBoardView({ sessionId, useSessions, t, openSession }) {
  const { projects, tasks, projectId, setProjectId, loading, error, reload } = useBoard();
  const [detail, setDetail] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState("medium");

  const currentSessionTitle =
    useSessions?.((s) => s?.sessionById?.[sessionId]?.title ?? s?.sessionsById?.[sessionId]?.title ?? null) ?? null;

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

  return jsx("div", {
    className: "tb-board",
    children: [
      jsx("div", {
        className: "tb-toolbar",
        children: [
          jsx("span", { className: "tb-title", children: t.tab }),
          jsx("div", {
            style: { display: "flex", gap: 6, flexWrap: "wrap" },
            children: projects.map((p) =>
              jsx(Pill, {
                key: p.id,
                active: p.id === projectId,
                onClick: () => setProjectId(p.id),
                children: `${p.name}`,
              }),
            ),
          }),
          jsx("span", { style: { flex: 1 } }),
          jsx(Button, { size: "sm", onClick: () => setCreating(true), children: t.newTask }),
        ],
      }),
      loading
        ? jsx("div", { className: "tb-empty", children: t.loading })
        : error
          ? jsx("div", { className: "tb-empty", children: error })
          : jsx("div", {
              className: "tb-columns",
              children: COLUMN_ORDER.map((status) =>
                jsx(BoardColumn, {
                  key: status,
                  status,
                  label: t(status) || status,
                  tasks: byStatus(status),
                  t,
                  onOpenCard: (task) => setDetail(task),
                  onDropTask: handleDrop,
                  onQuickAdd: handleQuickAdd,
                  onOpenSession: openSession,
                }),
              ),
            }),
      detail
        ? jsx(TaskDetailModal, {
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
            openSession,
          })
        : null,
      creating
        ? jsx(Modal, {
            open: true,
            onClose: () => setCreating(false),
            title: t.newTask,
            children: jsx("div", {
              className: "tb-modal-body",
              children: [
                jsx(Input, {
                  autoFocus: true,
                  value: newTitle,
                  placeholder: t.newTask,
                  onChange: (e) => setNewTitle(e.target.value),
                  onKeyDown: (e) => e.key === "Enter" && handleCreate(),
                }),
                jsx("div", {
                  className: "tb-actions",
                  children: [
                    jsx(Button, { variant: "ghost", size: "sm", onClick: () => setCreating(false), children: t.cancel }),
                    jsx(Button, { variant: "primary", size: "sm", onClick: handleCreate, children: t.newTask }),
                  ],
                }),
              ],
            }),
          })
        : null,
    ],
  });
}
