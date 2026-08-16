// dsh-taskboard 客户端入口：注入 conversation.view 槽位渲染看板。
import { TaskBoardView } from "./TaskBoardView.jsx";
import { NS, zh, en } from "./locales.js";
import { CSS } from "./styles.js";

export const name = "dsh-taskboard";
export const inject = ["slots", "locale", "connection"];

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

  // 在对话中打开：新建一个 dsh 会话并注入议题上下文，让新会话的 Agent 接手任务。
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
      const intro =
        `继续处理看板任务 ${task.identifier}：${task.title}\n\n` +
        `${task.description ?? ""}\n` +
        `（任务当前状态：${task.status}，优先级：${task.priority}，项目：${task.projectId}）\n` +
        `请用 taskboard 工具推进这个任务：先 taskboard_query 查看，处理后 move_task 流转状态，完成后移入 in_review 等用户确认。`;
      await conn.api.sessions.prompt({ sessionId: sid, mode: "queue", content: [{ type: "text", text: intro }] });
      console.log(`[taskboard] opened session ${sid} for ${task.identifier}`);
    } catch (e) {
      console.error("[taskboard] openSession failed", e);
    }
  }

  const tabLabel = () => {
    try {
      return ctx.locale?.bind?.(NS)?.("tab") ?? "任务看板";
    } catch {
      return "任务看板";
    }
  };

  ctx.slots.inject("conversation.view", () =>
    ctx.slots.register(
      {
        name: "conversation.view",
        id: "task-board",
        order: 30,
        label: tabLabel,
        locale: NS,
        inject: () => ({ openSession }),
      },
      TaskBoardView,
    ),
  );
}

export { apply };
