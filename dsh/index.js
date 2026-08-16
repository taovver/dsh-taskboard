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

export const name = "taskboard";
export const inject = ["tools"];

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
