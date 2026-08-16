# dsh-taskboard

DeepSeek Harness 任务看板插件：人和 Agent 的共同工作空间。跨对话共享、AI 自动认领/流转、SQLite 持久化、乐观锁、SSE 实时同步。

复刻自 [Codex Taskboard](https://github.com/chuspeeism/dashi-taskboard)（dashi-taskboard）的核心能力，适配 dsh。

## 它是什么

一句话：把对话里的工作拆成**可跟踪的任务卡片**，用 6 列看板（积压/待办/执行中/待确认/受阻/已完成）管理。任务跨对话共享，AI 通过 `taskboard_query` / `taskboard_mutate` 工具自动认领、推进、汇报；**AI 不能自己标完成**——必须用户确认（`userConfirm` 硬门槛）。

- 手动用：拖拽换列、点卡详情编辑、评论、归档、「在对话中打开」带上下文到新会话
- AI 自动用：直接跟模型说"把 X 拆成任务跟踪"，模型自动建卡、流转状态、留评论

## 即插即用的 Agent Skill

仓库自带 `skills/manage-taskboard/SKILL.md`：一个 Agent skill，教任何 harness 的 AI 怎么通过 HTTP API 管理看板（含完整工作流规则）。在 dsh 里模型直接用内置工具即可；其他环境把该 skill 链接到对应 skill 目录即可。

```
ln -s <repo>/skills/manage-taskboard ~/.claude/skills/manage-taskboard   # Claude Code 示例
```

## 能力

- **完整状态流**：`backlog / todo / in_progress / in_review / blocked / done / canceled`，加优先级、标签、项目、归档
- **跨对话共享**：按项目组织，任何 dsh 会话都能看到全量看板
- **AI 自动化**：模型通过 `taskboard_query` / `taskboard_mutate` 两个工具认领任务、流转状态、加评论；`done` 必须有用户确认（`userConfirm` 硬门槛），杜绝 AI 自说自话
- **乐观锁**：每次写操作带 `version`，冲突返回 `VERSION_CONFLICT`，模型自动重读重试
- **会话归属**：谁创建/处理了任务记录在卡片上（会话 chip），可"在对话中打开"把任务上下文带进新会话
- **SQLite 持久化**：重启不丢，数据在 `~/.dsh/profiles/web/data/taskboard.db`
- **SSE 实时刷新**：多客户端同时编辑实时同步

## 架构

```
dsh-taskboard/
├── dsh/index.js        # 宿主入口：装配 db/routes/tools/sessions/events
├── dsh/db.js           # node:sqlite 三表(projects/tasks/comments) + CRUD + 乐观锁
├── dsh/routes.js       # /taskboard/* HTTP 路由 + SSE
├── dsh/tools.js        # taskboard_query / taskboard_mutate 模型工具
├── dsh/sessions.js     # 会话归属注册表(session/event)
├── dsh/prompt.js       # 10 条工作流协议
└── dsh/client.js       # 浏览器端(esbuild 编译产物)
client/src/             # UI 源码(React, esbuild 打包)
```

## 开发

```bash
npm install            # 装 esbuild
npm run build:client   # 改 UI 后重新打包 dsh/client.js
```

## 安装(已装)

`~/.dsh/profiles/web/package.json` 里 `dsh-taskboard` 是 `link:` 依赖，重启 dsh 后生效。

## API 速览

```
GET    /taskboard/health
GET    /taskboard/api/projects
POST   /taskboard/api/tasks                      # {projectId,title,description?,status?,priority?,labels?}
GET    /taskboard/api/tasks?project=&status=&archived=
PATCH  /taskboard/api/tasks/:id                  # {version, changes:{...}}
POST   /taskboard/api/tasks/:id/move             # {version, status, sessionId?}
POST   /taskboard/api/tasks/:id/archive|restore  # {version}
GET|POST /taskboard/api/tasks/:id/comments
PATCH|DELETE /taskboard/api/comments/:id
GET    /taskboard/api/events                     # SSE
```

## 二期(预留)

- 流程编排：触发器/条件/动作画布
- 附件、工作流画布持久化
- `taskctl`-style CLI
- 「在对话中打开」增强：自动切换到新会话
