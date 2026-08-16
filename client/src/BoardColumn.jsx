// 看板列：列头(状态+计数) + 卡片列表 + HTML5 DnD 落点 + 快速新增。
import { jsx } from "react/jsx-runtime";
import { useState } from "react";
import { Input } from "@deepseek-ai/dsh-client-ui-primitives";
import { TaskCard } from "./TaskCard.jsx";

export function BoardColumn({ status, label, tasks, t, onOpenCard, onDropTask, onQuickAdd, onOpenSession }) {
  const [dragover, setDragover] = useState(false);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");

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

  return jsx("div", {
    className: `tb-column${dragover ? " tb-column-dragover" : ""}`,
    onDragOver: (e) => {
      e.preventDefault();
      setDragover(true);
    },
    onDragLeave: () => setDragover(false),
    onDrop,
    children: [
      jsx("div", {
        className: "tb-column-head",
        children: [
          jsx("span", { children: label }),
          jsx("span", { className: "tb-column-count", children: String(tasks.length) }),
        ],
      }),
      jsx("div", {
        className: "tb-column-list",
        children: tasks.length
          ? tasks.map((task) =>
              jsx(TaskCard, { task, t, onOpen: onOpenCard, onOpenSession }, task.id),
            )
          : jsx("div", { className: "tb-empty", children: t.noTasks }),
      }),
      adding
        ? jsx("div", {
            className: "tb-quickadd",
            children: jsx(Input, {
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
              onBlur: submitQuickAdd,
            }),
          })
        : jsx("button", {
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
              textAlign: "left",
            },
          }),
    ],
  });
}
