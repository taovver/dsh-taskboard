// dsh-taskboard 宿主插件入口：装配 SQLite 存储 + /taskboard/* HTTP 路由 + 模型工具 + 会话归属。
// 仿 modlens 的零依赖姿态：只 import node 内置模块与包内模块。
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { TaskboardDB } from "./db.js";
import { EventHub } from "./events.js";
import { SessionRegistry } from "./sessions.js";
import { mountTaskboardRoutes } from "./routes.js";
import { registerTaskboardTools } from "./tools.js";
import { TASKBOARD_REMINDER } from "./prompt.js";

export const name = "taskboard";
export const inject = ["tools"];

// 从消息块提取纯文本（content 可能是 string 或 block 数组）。
function extractText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => {
      if (typeof block === "string") return block;
      if (block && typeof block.text === "string") return block.text;
      return "";
    })
    .join("\n");
}

// 收到用户实质需求时，在 turn 的第一步注入"拆任务建卡"提醒。
// 只在 step === 1、最后一条是用户文本消息（非工具/插件来源）时注入一次。
// 注意：不能往消息列表"新增一条 system 消息"——dsh 客户端处理不了会崩；
// 只能把提醒追加进已有的第一条 system 消息的 content（与 modlens 改消息块的方式一致）。
function registerProactiveReminder(ctx) {
  if (typeof ctx.on !== "function") return;
  ctx.on("agent/pre-step", async (payload, next) => {
    const decision = await next();
    if (decision.kind !== "enter") return decision;
    if (payload?.step !== 1) return decision;
    const messages = decision.messages;
    if (!Array.isArray(messages) || messages.length === 0) return decision;
    const last = messages[messages.length - 1];
    if (last?.role !== "user") return decision;
    const source = last.source?.kind;
    if (source === "tool" || source === "plugin" || source === "attachment") return decision;
    const text = extractText(last.content);
    if (!text || text.trim().length < 8) return decision;
    const sys = messages[0];
    if (!sys || sys.role !== "system") return decision;
    const note = `\n\n${TASKBOARD_REMINDER}`;
    if (Array.isArray(sys.content)) {
      sys.content = [...sys.content, { type: "text", text: note }];
    } else if (typeof sys.content === "string") {
      sys.content = sys.content + note;
    } else {
      return decision;
    }
    return decision;
  });
}

function profileName() {
  const i = process.argv.indexOf("--profile");
  if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("-")) {
    return process.argv[i + 1];
  }
  return "web";
}

export function apply(ctx, config = {}) {
  const profile = config.profile ?? profileName();
  const dataDir = join(process.env.DSH_HOME ?? join(homedir(), ".dsh"), "profiles", profile, "data");
  mkdirSync(dataDir, { recursive: true });

  const db = new TaskboardDB(join(dataDir, "taskboard.db"));
  const events = new EventHub();
  const sessions = new SessionRegistry(ctx);

  registerTaskboardTools(ctx, db, sessions);
  registerProactiveReminder(ctx);

  // webServer 只在 web profile 存在，用 scoped inject 可选挂载（modlens 模式）。
  if (typeof ctx.inject === "function") {
    ctx.inject(["webServer"], (host) => {
      host.effect(() => {
        const disposers = mountTaskboardRoutes(host, db, events, sessions);
        console.error(`[taskboard] 看板路由已挂载: ${dataDir}`);
        return () => {
          for (const disposer of disposers) {
            try {
              disposer?.();
            } catch {}
          }
        };
      }, "taskboard: http routes");
    });
  }

  ctx.effect(
    () => () => {
      try {
        events.close();
      } catch {}
      try {
        db.close();
      } catch {}
    },
    "taskboard: teardown",
  );
}
