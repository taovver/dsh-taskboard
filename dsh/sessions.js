// 会话归属注册表：监听 dsh 的 session/event，维护 sessionId → { title } 快照，
// 供看板工具记录"哪个会话处理了哪个任务"并在 UI 上展示会话 chip。
export class SessionRegistry {
  constructor(ctx) {
    this.map = new Map();
    if (typeof ctx?.on === "function") {
      ctx.on("session/event", (session, event) => {
        const id = session?.id;
        if (!id) return;
        const existing = this.map.get(id);
        const title =
          typeof session?.title === "string" && session.title
            ? session.title
            : event?.title ?? existing?.title ?? "";
        this.map.set(id, { title });
      });
    }
  }

  title(id) {
    if (!id) return null;
    return this.map.get(id)?.title ?? null;
  }

  info(id) {
    if (!id) return null;
    const entry = this.map.get(id);
    return entry ? { id, title: entry.title ?? null } : { id, title: null };
  }
}
