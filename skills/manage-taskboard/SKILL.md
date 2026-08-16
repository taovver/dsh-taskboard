---
name: manage-taskboard
description: 管理 dsh-taskboard 任务看板（项目、任务、评论）。当用户提到任务看板、把工作拆成任务跟踪、或需要跨对话共享任务进度时使用。通过 HTTP API 或 dsh 原生工具（taskboard_query / taskboard_mutate）操作。
---

# Manage Taskboard

dsh-taskboard 是一个跨对话共享的任务看板：人和 Agent 的共同工作空间。任务是组织单元，而不是对话——任务承载完整上下文、可被任意会话认领和推进。

## 两种接入方式

- **在 dsh（DeepSeek Harness）里**：用模型自带的 `taskboard_query`（只读）/ `taskboard_mutate`（写）工具，无需 curl。
- **在任何其他 harness / CLI 里**：调用 HTTP API，默认地址 `http://127.0.0.1:3080`（dsh web profile 端口）。

## 状态流（任务生命周期）

```
backlog(积压) → todo(待办) → in_progress(执行中) → in_review(待确认) → done(已完成)
                                    ↘              ↗
                               blocked(受阻)   canceled(取消)
```

优先级：`none / urgent / high / medium / low`。每个任务有 `version`（乐观锁）。

## 工作流规则（必须遵守）

1. **先读后改**：写操作前先读取任务，拿到最新 `version`。
2. 每次写操作携带 `expectedVersion`（最近一次读取的 version）。
3. 开始处理任务前，先 `move_task` 到 `in_progress`。
4. 自测通过后，只能 `move_task` 到 `in_review`，**绝不直接到 done**。
5. `done` 仅在用户明确确认接受后使用，且必须引用用户原话。
6. 无法继续 → `blocked`；决定不做 → `canceled`。
7. 每次进展/验证结果/风险，用 `add_comment` 留下记录。
8. 遇到 `VERSION_CONFLICT`：重新读取任务，用新 `version` 重试一次，不抢占、不无限重试。

## HTTP API 速查

```bash
# 项目
curl http://127.0.0.1:3080/taskboard/api/projects

# 任务列表（按项目 + 非归档）
curl "http://127.0.0.1:3080/taskboard/api/tasks?project=local&archived=false"

# 创建任务
curl -X POST http://127.0.0.1:3080/taskboard/api/tasks \
  -H 'content-type: application/json' \
  -d '{"projectId":"local","title":"任务标题","status":"backlog","priority":"high","labels":["mvc"]}'

# 读取单个任务（拿 version）
curl http://127.0.0.1:3080/taskboard/api/tasks/LOCAL-1

# 移动状态（乐观锁）
curl -X POST http://127.0.0.1:3080/taskboard/api/tasks/LOCAL-1/move \
  -H 'content-type: application/json' \
  -d '{"version":1,"status":"in_progress"}'

# 更新字段
curl -X PATCH http://127.0.0.1:3080/taskboard/api/tasks/LOCAL-1 \
  -H 'content-type: application/json' \
  -d '{"version":2,"changes":{"title":"新标题","priority":"urgent"}}'

# 评论
curl -X POST http://127.0.0.1:3080/taskboard/api/tasks/LOCAL-1/comments \
  -H 'content-type: application/json' \
  -d '{"body":"进展：已实现核心功能"}'
```

写操作在浏览器环境需带同源 Origin；CLI/curl 无 Origin 头直接可用。冲突返回 `409 VERSION_CONFLICT`，带 `expectedVersion` / `actualVersion`。

## 会话归属

写操作可带 `sessionId` / `sessionTitle` 记录"哪个对话处理了这个任务"（dsh 工具会自动从当前会话取）。看板卡片会显示会话来源 chip。

## 安装（dsh 插件）

```bash
cd ~/.dsh/profiles/web
# package.json 的 dependencies 加 "dsh-taskboard": "link:<你的项目绝对路径>"
# dsh.profile.bundles 加 "dsh-taskboard"
pnpm install
launchctl kickstart -k gui/$(id -u)/com.user.dsh-web   # 重启 dsh web
```

数据存 `~/.dsh/profiles/web/data/taskboard.db`（SQLite），重启不丢。
