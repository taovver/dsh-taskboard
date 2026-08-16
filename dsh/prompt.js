// 看板工作流协议：浓缩自 Codex Taskboard 的 manage-taskboard SKILL.md，
// 注入 taskboard_mutate 工具描述，模型每次调用都会读到这段强制规则。
// 注入到每个"收到用户实质需求"turn 的第一步，提醒模型拆任务建卡。
// 只在 step 1 且用户消息非工具/插件来源时注入一次，避免每步都打扰。
export const TASKBOARD_REMINDER = `[系统提示] 用户刚刚提出了一个需求。如果这个需求包含多个步骤、子任务，或需要持续跟踪进度（例如复盘、调研、开发功能、多步分析），请用 taskboard 工具把工作拆解成任务卡片跟踪：taskboard_mutate create_task 建卡（默认 backlog/todo）→ 开始处理时 move_task 到 in_progress → 完成后 move_task 到 in_review → 用户确认后才 done，并用 add_comment 记录进展。如果只是简单的一次性回复，不需要建卡。任务卡片会让用户在任何对话里都能看到进度。`;

export const TASKBOARD_PROTOCOL = `任务看板使用协议（必须遵守）：
1. 先读后改：任何写操作前先 taskboard_query 读取任务/项目，拿到最新 version。
2. 每次写操作必须携带 expectedVersion（= 最近一次读取返回的 version）。
3. 开始处理一个任务前，先把任务 move_task 到 in_progress。
4. 自测通过后，只能 move_task 到 in_review，绝不直接到 done。
5. done 仅在用户明确确认接受/明确要求标记完成时使用，且必须在 userConfirm 字段引用用户原话，否则工具会拒绝。
6. 无法继续的任务 move_task 到 blocked，决定不再做的任务 move_task 到 canceled。
7. 每个任务的进展、验证结果、风险都要 add_comment 留下记录。
8. 收到 VERSION_CONFLICT 时：重新 taskboard_query get_task 读取新状态，用最新的 version 重试一次；不要抢占或无限重试。
9. 任务按项目组织（projectId），跨对话共享：新对话可以先 list_projects + list_tasks 看到全量看板。
10. 新建任务用 create_task，status 默认 backlog，做好拆解；不要把整个用户请求塞进一个任务。`;

export function renderTask(task) {
  const lines = [`${task.identifier} [${task.status}] ${task.title}`];
  if (task.priority !== "none") lines.push(`  优先级: ${task.priority}`);
  if (Array.isArray(task.labels) && task.labels.length) lines.push(`  标签: ${task.labels.join(", ")}`);
  if (task.sessionTitle) lines.push(`  会话: ${task.sessionTitle}`);
  if (task.description) lines.push(`  描述: ${task.description}`);
  return lines.join("\n");
}

export function renderConflict(error) {
  return `VERSION_CONFLICT: 任务已被其他客户端修改（你的 expectedVersion=${error.details?.expectedVersion}，当前 actualVersion=${error.details?.actualVersion}）。请重新 taskboard_query get_task 读取最新状态，用新 version 重试。`;
}
