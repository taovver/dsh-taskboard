// 看板卡片：identifier + 标题 + 优先级 + 标签 + 会话 chip。
import { jsx } from "react/jsx-runtime";
import { Pill } from "@deepseek-ai/dsh-client-ui-primitives";

const PRIORITY_CLASS = { urgent: "tb-pill-urgent", high: "tb-pill-high", medium: "tb-pill-medium", low: "tb-pill-low" };

export function TaskCard({ task, t, onOpen, onOpenSession }) {
  const priorityLabel = t(task.priority) || task.priority;
  const labels = Array.isArray(task.labels) ? task.labels.slice(0, 3) : [];
  return jsx("div", {
    className: "tb-card",
    draggable: true,
    onDragStart: (e) => {
      e.dataTransfer.setData("text/plain", task.id);
      e.dataTransfer.effectAllowed = "move";
    },
    onClick: () => onOpen(task),
    children: jsx("div", {
      className: "tb-card-inner",
      children: [
        jsx("div", { className: "tb-card-id", children: task.identifier }),
        jsx("div", { className: "tb-card-title", children: task.title }),
        jsx("div", {
          className: "tb-card-meta",
          children: [
            task.priority !== "none"
              ? jsx(Pill, { className: `tb-pill ${PRIORITY_CLASS[task.priority] || ""}`, children: priorityLabel })
              : null,
            ...labels.map((label) => jsx(Pill, { className: "tb-pill tb-label-chip", children: label }, label)),
            task.sessionTitle
              ? jsx(Pill, {
                  className: "tb-pill tb-session-chip",
                  title: task.sessionId,
                  onClick: (e) => {
                    e.stopPropagation();
                    onOpenSession?.(task);
                  },
                  children: task.sessionTitle,
                })
              : null,
          ],
        }),
      ],
    }),
  });
}
